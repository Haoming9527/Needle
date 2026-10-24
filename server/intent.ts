import { createHash, randomUUID } from 'node:crypto';
import { MAX_SYNTHESIS_OBSERVATIONS, type SynthesisSnapshot, type SynthesisOutput, type IntentSynthesisState } from '../shared/synthesis.js';
import type { DatabaseSync } from 'node:sqlite';
import type { IntentAction, IntentConnection, IntentFeedback, IntentHypothesis, IntentObservation, IntentObservationInput, IntentState, IntentTag } from '../shared/intent.js';
import { ATTENTION_DWELL_MS, DEMO_ATTENTION_SOURCES, attentionSourceForUrl, type AttentionCapture } from '../shared/attention.js';
import { ApiError } from './errors.js';

const weights = { dwell: 2, revisit: 2, find: 3, save: 4, wishlist: 4, group_interest: 4, cart: 5 };
const strength = { dwell: 0, revisit: 1, find: 2, save: 3, wishlist: 4, group_interest: 5, cart: 6 };
const weak = (value: IntentObservation) => value.action === 'dwell' || value.action === 'revisit';
const site = (origin: string) => new URL(origin).hostname.replace(/^www\./, '');
const semanticKey = (value: IntentObservationInput) => `${sourceIdentity(value) ?? site(value.sourceOrigin)}:${value.entityKey ?? value.summary.trim().toLowerCase().replace(/\s+/g, ' ')}`;
function sourceIdentity(value: IntentObservationInput): string | undefined {
  const capture = value.capture;
  if (capture?.method === 'measured_cursor' && capture.environment === 'controlled_demo' && value.provenance === 'demo_fixture') {
    const source = DEMO_ATTENTION_SOURCES[capture.sourceId];
    if (source && source.targetId === capture.targetId && capture.actualOrigin === value.sourceOrigin && attentionSourceForUrl(`${capture.actualOrigin}${source.path}`)?.id === source.id) return `demo:${source.id}`;
  }
  const host = site(value.sourceOrigin);
  return ['localhost', '127.0.0.1', '[::1]', 'needle.local'].includes(host) || host.endsWith('.localhost') || /^127\./.test(host) || host.endsWith('.local') ? undefined : host;
}
const parse = <T>(data: unknown): T => JSON.parse(String(data)) as T;
interface StoredIntentFeedback extends IntentFeedback { supportingObservationIds?: string[] }
function matchesSupport(feedback: StoredIntentFeedback | undefined, ids: string[]): boolean {
  const bound = feedback?.supportingObservationIds;
  return !!bound && bound.length === ids.length && [...bound].sort().every((id, index) => id === [...ids].sort()[index]);
}


/** Bounded reasoning templates keep captured actions distinct from proposed needs. */
function connectionFor(first: IntentObservation, second: IntentObservation, key: Exclude<IntentHypothesis['recommendationKey'], 'contextual'>, response?: IntentFeedback): IntentConnection {
  const corrected = response?.action === 'correct';
  const confirmed = corrected || response?.action === 'confirm';
  const templates = {
    'portable-lunch': {
      tentative: 'Carrying prepared meals during a commute might be useful.',
      confirmed: 'You confirmed that carrying prepared meals during a commute would be useful.',
      uncertainty: 'These visits do not establish that you prepare meals, commute by bicycle, or want to buy anything.',
      question: 'Would bringing prepared food on a commute be useful to you?',
      rationale: 'Based on the need you confirmed, a portable container could help carry prepared food. Suitability still needs checking.',
    },
    'home-meal-prep': {
      tentative: 'Preparing and storing meals at home might be useful.',
      confirmed: 'You clarified that the useful need is preparing and storing food at home.',
      uncertainty: 'The original browsing connection did not establish this need; your correction supplies the context.',
      question: 'Would help preparing and storing food at home be useful?',
      rationale: 'Your correction points to home food storage. The earlier commuting observation is not a reason to recommend a portable product.',
    },
    recording: {
      tentative: 'Putting together a home recording setup might be useful.',
      confirmed: 'You confirmed that a home recording setup would be useful.',
      uncertainty: 'These visits do not establish that you record audio or want to buy equipment.',
      question: 'Would help putting together a home recording setup be useful?',
      rationale: 'Based on the need you confirmed, a microphone could support recording. Compatibility and suitability still need checking.',
    },
    'work-calls': {
      tentative: 'Improving everyday work calls might be useful.',
      confirmed: 'You clarified that improving everyday work calls is the useful need.',
      uncertainty: 'The original recording hypothesis did not establish this need; your correction supplies the context.',
      question: 'Would help improving everyday work calls be useful?',
      rationale: 'Your correction points to equipment for everyday calls. The earlier recording hypothesis does not justify a recording-focused purchase.',
    },
  };
  const template = templates[key];
  return {
    observations: [first, second].map(value => ({ observationId: value.id, sourceTitle: value.sourceTitle, action: value.action, summary: value.summary, provenance: value.provenance, ...(value.capture ? { capture: value.capture } : {}) })),
    inferredNeed: { text: confirmed ? template.confirmed : template.tentative, basis: corrected ? 'user_corrected' : confirmed ? 'user_confirmed' : 'hypothesis' },
    uncertainty: confirmed ? `${corrected ? template.uncertainty + ' ' : ''}Confirming a useful need does not express a purchase decision.` : template.uncertainty,
    question: template.question,
    ...(confirmed ? { productRationale: template.rationale } : {}),
  };
}

/** Local single-user evidence memory. Scores are explainable heuristic points, never probabilities. */
interface StoredSynthesis { generation?: string; contextKey: string; result: SynthesisOutput; generatedAt: string; correction?: string; constraints?: string; model: string; promptVersion: string }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const modelHypothesisId = (saved: StoredSynthesis) => `ai-${digest([saved.contextKey, saved.result, saved.correction ?? '', ...(saved.generation ? [saved.generation] : [])]).slice(0, 48)}`;

export class IntentStore {
  private synthesisConfig?: { available: boolean; model: string; promptVersion: string };
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS intent_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_observations (id TEXT PRIMARY KEY, semantic_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_events (id TEXT PRIMARY KEY, semantic_key TEXT NOT NULL, action TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS intent_event_entity ON intent_events(semantic_key);
      CREATE TABLE IF NOT EXISTS intent_seen (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS intent_feedback (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_runtime (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_syntheses (id INTEGER PRIMARY KEY, data TEXT NOT NULL);`);
    // Upgrade prior aggregate-only databases without changing canonical observation IDs.
    for (const row of db.prepare('SELECT id,semantic_key,data FROM intent_observations').all()) {
      if (!db.prepare('SELECT id FROM intent_events WHERE semantic_key=? LIMIT 1').get(row.semantic_key)) {
        const previous = parse<IntentObservation>(row.data);
        db.prepare('INSERT OR IGNORE INTO intent_events VALUES (?,?,?,?)').run(previous.id, String(row.semantic_key), previous.action, JSON.stringify(previous));
      }
    }
  }
  configureSynthesis(config: { available: boolean; model: string; promptVersion: string }): void {
    if (JSON.stringify(this.synthesisConfig) !== JSON.stringify(config)) this.bumpRuntime();
    this.synthesisConfig = { ...config };
  }
  private runtime(key: string): number { return Number(this.db.prepare('SELECT value FROM intent_runtime WHERE key=?').get(key)?.value ?? 0); }
  private bumpRuntime(consentEpoch = false): void {
    this.db.prepare("INSERT INTO intent_runtime VALUES ('revision',1) ON CONFLICT(key) DO UPDATE SET value=value+1").run();
    if (consentEpoch) this.db.prepare("INSERT INTO intent_runtime VALUES ('consentEpoch',1) ON CONFLICT(key) DO UPDATE SET value=value+1").run();
  }
  synthesisRevision(): number { return this.runtime('revision'); }
  synthesisSnapshot(): SynthesisSnapshot {
    const all = this.db.prepare('SELECT data FROM intent_observations ORDER BY rowid').all().map(row => parse<IntentObservation>(row.data));
    const eligible = all.filter(value => !!sourceIdentity(value));
    const cohorts = [eligible.filter(value => !!value.capture), eligible.filter(value => !value.capture && value.provenance === 'observed'), eligible.filter(value => !value.capture && value.provenance === 'demo_fixture')];
    const distinct = (values: IntentObservation[]) => new Set(values.map(value => sourceIdentity(value))).size;
    const cohort = cohorts.find(values => distinct(values) >= 2) ?? cohorts.find(values => values.length) ?? [];
    // Round-robin by source keeps the bound from hiding a second source behind many items on one page.
    const groups = new Map<string, IntentObservation[]>();
    for (const value of [...cohort].reverse()) { const key = sourceIdentity(value)!; groups.set(key, [...(groups.get(key) ?? []), value]); }
    const selected: IntentObservation[] = [];
    for (let index = 0; selected.length < MAX_SYNTHESIS_OBSERVATIONS; index++) {
      let found = false;
      for (const group of groups.values()) { if (group[index] && selected.length < MAX_SYNTHESIS_OBSERVATIONS) { selected.push(group[index]!); found = true; } }
      if (!found) break;
    }
    const observations = selected.sort((a, b) => a.id.localeCompare(b.id)).map(value => ({
      id: value.id, sourceKey: sourceIdentity(value)!, sourceTitle: value.sourceTitle.slice(0, 200), summary: value.summary.slice(0, 500), action: value.action,
      tags: [...new Set(value.tags)].sort(), provenance: value.provenance,
      ...(value.capture ? { measurement: { dwellMs: value.capture.dwellMs, visitOrdinal: value.capture.visitOrdinal } } : {}),
    }));
    const contextKey = digest({ consentEpoch: this.runtime('consentEpoch'), model: this.synthesisConfig?.model ?? '', promptVersion: this.synthesisConfig?.promptVersion ?? '', observations });
    return { contextKey, observations };
  }
  saveSynthesis(expectedContextKey: string, result: SynthesisOutput, correction?: string): IntentState {
    const consent = this.db.prepare("SELECT value FROM intent_settings WHERE key='consent'").get()?.value === 'true';
    if (!consent) throw new ApiError(409, 'INTENT_CONSENT_REQUIRED', 'Enable context memory before connecting observations.');
    if (!this.synthesisConfig) throw new ApiError(409, 'SYNTHESIS_NOT_CONFIGURED', 'Context synthesis is not configured.');
    const snapshot = this.synthesisSnapshot();
    if (snapshot.contextKey !== expectedContextKey) throw new ApiError(409, 'SYNTHESIS_CONTEXT_CHANGED', 'The supporting context changed. Connect the current observations again.');
    const fail = () => { throw new ApiError(422, 'INVALID_SYNTHESIS', 'The proposed connection must be grounded in the current independent sources.'); };
    if (!result || !['hypothesis', 'abstain'].includes(result.outcome) || typeof result.uncertainty !== 'string' || !result.uncertainty.trim() || result.uncertainty.length > 1000 || !Array.isArray(result.evidence) || result.evidence.length > MAX_SYNTHESIS_OBSERVATIONS) fail();
    if (correction !== undefined && (typeof correction !== 'string' || !correction.trim() || correction.length > 1000)) fail();
    if (result.evidence.some(value => !value || typeof value !== 'object' || typeof value.observationId !== 'string')) fail();
    const ids = result.evidence.map(value => value.observationId);
    if (new Set(ids).size !== ids.length) fail();
    const cited = result.evidence.map(value => {
      const observation = snapshot.observations.find(item => item.id === value.observationId);
      if (!observation || typeof value.reason !== 'string' || !value.reason.trim() || value.reason.length > 500) fail();
      return observation!;
    });
    if (result.outcome === 'hypothesis') {
      if (new Set(cited.map(value => value.sourceKey)).size < 2) fail();
      for (const [key, limit] of [['label', 100], ['need', 500], ['why', 1000], ['question', 500], ['productQuery', 300]] as const) {
        if (typeof result[key] !== 'string' || !result[key]?.trim() || result[key]!.length > limit) fail();
      }
    } else if (['label', 'need', 'why', 'question', 'productQuery'].some(key => result[key as keyof SynthesisOutput] !== null)) fail();
    let constraints: string | undefined;
    if (correction) {
      const row = this.db.prepare('SELECT data FROM intent_syntheses WHERE id=1').get();
      const previous = row ? parse<StoredSynthesis>(row.data) : undefined;
      if (previous?.contextKey === expectedContextKey && previous.result.outcome === 'hypothesis') {
        const priorId = modelHypothesisId(previous);
        const feedbackRow = this.db.prepare('SELECT data FROM intent_feedback WHERE id=?').get(priorId);
        const priorFeedback = feedbackRow ? parse<StoredIntentFeedback>(feedbackRow.data) : undefined;
        const bound = matchesSupport(priorFeedback, previous.result.evidence.map(value => value.observationId));
        constraints = (bound ? priorFeedback?.constraints : undefined) ?? previous.constraints;
      }
    }
    const saved: StoredSynthesis = { generation: randomUUID(), contextKey: expectedContextKey, result, generatedAt: new Date().toISOString(), correction, constraints, model: this.synthesisConfig.model, promptVersion: this.synthesisConfig.promptVersion };
    this.db.prepare('INSERT INTO intent_syntheses VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(saved));
    this.bumpRuntime();
    return this.getState();
  }
  private modelHypothesis(saved: StoredSynthesis, observations: IntentObservation[], feedback: Map<string, StoredIntentFeedback>): IntentHypothesis {
    const result = saved.result;
    const supporting = result.evidence.map(value => observations.find(item => item.id === value.observationId)!);
    const evidenceIds = supporting.map(value => value.id);
    const id = modelHypothesisId(saved);
    const stored = feedback.get(id);
    const response = matchesSupport(stored, evidenceIds) ? stored : undefined;
    const confirmed = response?.action === 'confirm';
    const tags = new Set(supporting.flatMap(value => value.tags));
    const explicit = observations.filter(value => value.tags.some(tag => tags.has(tag)) && ['wishlist', 'save', 'cart', 'group_interest'].includes(value.action));
    const readiness: IntentHypothesis['readiness'] = !confirmed ? 'exploring' : explicit.some(value => value.action === 'cart') ? 'ready_to_review' : explicit.some(value => value.action === 'group_interest') ? 'conditional' : explicit.some(value => ['wishlist', 'save'].includes(value.action)) ? 'considering' : 'exploring';
    return { id, label: result.label!, question: result.question!, interest: confirmed ? 'confirmed' : 'tentative', status: response?.action === 'dismiss' ? 'dismissed' : 'active',
      readiness, evidencePoints: 0, evidenceIds, constraints: response?.constraints ?? saved.constraints, recommendationKey: 'contextual',
      origin: { kind: 'model', model: saved.model, promptVersion: saved.promptVersion, evidenceFingerprint: saved.contextKey, productQuery: result.productQuery! },
      explanation: `${result.why} Model-generated connection; no purchase probability or calibrated confidence is asserted.`,
      connection: {
        observations: supporting.map(value => ({ observationId: value.id, sourceTitle: value.sourceTitle, action: value.action, summary: value.summary, provenance: value.provenance, ...(value.capture ? { capture: value.capture } : {}) })),
        inferredNeed: { text: result.need!, basis: confirmed ? saved.correction ? 'user_corrected' : 'user_confirmed' : 'hypothesis' },
        why: result.why!, evidenceReasons: result.evidence, question: result.question!,
        uncertainty: `${result.uncertainty}${saved.correction ? confirmed ? ' This confirmed proposal incorporates your correction.' : ' This proposal considers your correction and still needs your confirmation.' : ''}${confirmed ? ' Confirming a useful need is not a purchase decision.' : ''}`,
        ...(confirmed ? { productRationale: result.why! } : {}),
      },
    };
  }
  getState(): IntentState {
    const consent = this.db.prepare("SELECT value FROM intent_settings WHERE key='consent'").get()?.value === 'true';
    const observations = this.db.prepare('SELECT data FROM intent_observations ORDER BY rowid').all().map(row => parse<IntentObservation>(row.data));
    const feedback = new Map(this.db.prepare('SELECT id,data FROM intent_feedback').all().map(row => [String(row.id), parse<StoredIntentFeedback>(row.data)]));
    const attentionConsent = consent && this.db.prepare("SELECT value FROM intent_settings WHERE key='attentionConsent'").get()?.value === 'true';
    const rules = evaluateIntent(observations, feedback);
    if (!this.synthesisConfig) return { consent, attentionConsent, observations, hypotheses: rules };
    const snapshot = this.synthesisSnapshot();
    const row = this.db.prepare('SELECT data FROM intent_syntheses WHERE id=1').get();
    const saved = row ? parse<StoredSynthesis>(row.data) : undefined;
    const current = saved?.contextKey === snapshot.contextKey && consent;
    const synthesis: IntentSynthesisState = { ...this.synthesisConfig, ...snapshot,
      status: saved ? current ? saved.result.outcome === 'abstain' ? 'abstained' : 'ready' : 'stale' : 'idle',
      ...(current && saved ? { generatedAt: saved.generatedAt, correction: saved.correction, result: saved.result } : {}),
    };
    const ai = current && saved?.result.outcome === 'hypothesis' ? this.modelHypothesis(saved, observations, feedback) : undefined;
    return { consent, attentionConsent, observations, synthesis,
      // Rule hypotheses stay available for the UI's explicit prepared-demo opt-in;
      // synthesis status never promotes a rule to a model-generated connection.
      hypotheses: ai ? [ai, ...rules] : rules };

  }
  setConsent(enabled: boolean): IntentState {
    const previous = this.db.prepare("SELECT value FROM intent_settings WHERE key='consent'").get()?.value === 'true';
    if (previous !== enabled) this.bumpRuntime(true);
    if (!enabled) this.db.prepare("DELETE FROM intent_settings WHERE key='attentionConsent'").run();
    this.db.prepare("INSERT INTO intent_settings VALUES ('consent',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(enabled));
    return this.getState();
  }
  setAttentionConsent(enabled: boolean): IntentState {
    if (enabled && !this.getState().consent) throw new ApiError(409, 'INTENT_CONSENT_REQUIRED', 'Enable context memory before enabling measured attention.');
    this.bumpRuntime();
    this.db.prepare("INSERT INTO intent_settings VALUES ('attentionConsent',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(enabled));
    return this.getState();
  }
  recordAttention(input: AttentionCapture): IntentState {
    if (!this.getState().attentionConsent) throw new ApiError(409, 'ATTENTION_CONSENT_REQUIRED', 'Enable measured attention before collecting cursor signals.');
    const source = attentionSourceForUrl(input.documentUrl);
    if (!source || source.id !== input.sourceId || source.targetId !== input.targetId) throw new ApiError(400, 'INVALID_ATTENTION_SOURCE', 'Use a registered demo page and reading region.');
    if (input.measurement.dwellMs < ATTENTION_DWELL_MS || (input.action === 'revisit' && input.measurement.visitOrdinal < 2)) throw new ApiError(400, 'INVALID_ATTENTION_MEASUREMENT', 'The cursor interaction did not meet the dwell or revisit threshold.');
    const origin = new URL(input.documentUrl).origin;
    return this.record({ id: input.id, action: input.action, sourceOrigin: origin, sourceTitle: source.title,
      summary: input.action === 'revisit' ? source.summary.replace('Spent time on', 'Returned to') : source.summary,
      tags: source.tags, provenance: 'demo_fixture', entityKey: `demo:${source.id}:${source.targetId}`,
      capture: { method: 'measured_cursor', environment: 'controlled_demo', sessionId: input.sessionId, pageInstanceId: input.pageInstanceId,
        sourceId: source.id, targetId: source.targetId, actualOrigin: origin, dwellMs: input.measurement.dwellMs,
        visitOrdinal: input.measurement.visitOrdinal, capturedAt: input.capturedAt },
    });
  }
  record(input: IntentObservationInput): IntentState {
    if (!this.getState().consent) throw new ApiError(409, 'INTENT_CONSENT_REQUIRED', 'Enable context memory before saving browsing signals.');
    if (this.db.prepare('SELECT id FROM intent_seen WHERE id=?').get(input.id)) return this.getState();
    const key = semanticKey(input);
    const event: IntentObservation = { ...input, sourceOrigin: new URL(input.sourceOrigin).origin, createdAt: new Date().toISOString() };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO intent_events VALUES (?,?,?,?)').run(event.id, key, event.action, JSON.stringify(event));
      this.db.prepare('INSERT INTO intent_seen VALUES (?)').run(input.id);
      this.rebuild(key);
      this.bumpRuntime();
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
  private rebuild(key: string): void {
    const row = this.db.prepare('SELECT data FROM intent_observations WHERE semantic_key=?').get(key);
    const previous = row ? parse<IntentObservation>(row.data) : undefined;
    const events = this.db.prepare('SELECT data FROM intent_events WHERE semantic_key=? ORDER BY rowid').all(key).map(value => parse<IntentObservation>(value.data));
    if (!events.length) { this.db.prepare('DELETE FROM intent_observations WHERE semantic_key=?').run(key); return; }
    const first = events[0]!;
    const strongest = events.reduce((best, event) => strength[event.action] >= strength[best.action] ? event : best, first);
    const next: IntentObservation = {
      ...first, id: previous?.id ?? first.id, createdAt: previous?.createdAt ?? first.createdAt,
      action: strongest.action,
      sourceOrigin: strongest.sourceOrigin, sourceTitle: strongest.sourceTitle, summary: strongest.summary,
      ...(strongest.capture ? { capture: strongest.capture } : {}),
      collectionId: [...events].reverse().find(event => event.collectionId)?.collectionId,
      tags: [...new Set(events.flatMap(event => event.tags))],
      provenance: events.some(event => event.provenance === 'demo_fixture') ? 'demo_fixture' : 'observed',
    };
    this.db.prepare('INSERT INTO intent_observations VALUES (?,?,?) ON CONFLICT(semantic_key) DO UPDATE SET data=excluded.data').run(next.id, key, JSON.stringify(next));
  }
  /** Retract active commerce evidence while preserving weaker earlier observations. */
  retractAction(sourceOrigin: string, entityKey: string, action: IntentAction): IntentState {
    const key = `${site(sourceOrigin)}:${entityKey}`;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM intent_events WHERE semantic_key=? AND action=?').run(key, action);
      this.rebuild(key);
      this.bumpRuntime();
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
  feedback(id: string, input: IntentFeedback): IntentState {
    const state = this.getState();
    if (input.action !== 'dismiss' && !state.consent) throw new ApiError(409, 'INTENT_CONSENT_REQUIRED', 'Enable context memory before confirming or correcting an interest.');
    const hypothesis = state.hypotheses.find(value => value.id === id);
    if (!hypothesis) throw new ApiError(404, 'INTENT_NOT_FOUND', 'That interest is no longer available.');
    if (input.action === 'correct' && hypothesis.origin?.kind === 'model') throw new ApiError(400, 'SYNTHESIS_CORRECTION_REQUIRED', 'Reconsider the context with your correction before confirming a new need.');
    if (input.action === 'correct' && !input.correction) throw new ApiError(400, 'CORRECTION_REQUIRED', 'Choose the corrected need.');
    if (input.action === 'correct' && ((id === 'lunch-on-the-move' && input.correction !== 'home-meal-prep') || (id === 'recording-setup' && input.correction !== 'work-calls'))) throw new ApiError(400, 'INVALID_CORRECTION', 'Choose a correction relevant to this interest.');
    const previous = this.db.prepare('SELECT data FROM intent_feedback WHERE id=?').get(id);
    const supportingObservationIds = hypothesis.connection.observations.map(value => value.observationId);
    const stored = previous ? parse<StoredIntentFeedback>(previous.data) : undefined;
    const prior = matchesSupport(stored, supportingObservationIds) ? stored : undefined;
    const updated: StoredIntentFeedback = { ...input, constraints: input.constraints ?? prior?.constraints ?? hypothesis.constraints, supportingObservationIds };
    this.db.prepare('INSERT INTO intent_feedback VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id, JSON.stringify(updated));
    this.bumpRuntime();
    return this.getState();
  }
  remove(id: string): IntentState {
    const row = this.db.prepare('SELECT semantic_key FROM intent_observations WHERE id=?').get(id);
    if (!row) return this.getState();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM intent_events WHERE semantic_key=?').run(row.semantic_key);
      this.db.prepare('DELETE FROM intent_observations WHERE id=?').run(id);
      this.bumpRuntime();
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
  reset(): IntentState {
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.exec('DELETE FROM intent_events; DELETE FROM intent_observations; DELETE FROM intent_feedback; DELETE FROM intent_seen; DELETE FROM intent_settings; DELETE FROM intent_syntheses;'); this.bumpRuntime(true); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
}

export function evaluateIntent(observations: IntentObservation[], feedback = new Map<string, StoredIntentFeedback>()): IntentHypothesis[] {
  const candidates = [
    { id: 'lunch-on-the-move', label: 'Lunch on the move', question: 'Are you looking for a way to bring your meal prep on your cycle commute?', tags: ['meal-prep', 'cycle-commute'] as IntentTag[], recommendationKey: 'portable-lunch' as const },
    { id: 'recording-setup', label: 'A recording setup', question: 'Are you putting together a home recording setup?', tags: ['recording', 'audio'] as IntentTag[], recommendationKey: 'recording' as const },
  ];
  return candidates.flatMap(candidate => {
    const relevant = observations.filter(value => value.tags.some(tag => candidate.tags.includes(tag)));
    // Require complementary evidence across two sites, not two repetitions of the same topic.
    const external = relevant.filter(value => !!sourceIdentity(value));
    const independent = (a: IntentObservation, b: IntentObservation) => sourceIdentity(a) !== sourceIdentity(b) && !!a.capture === !!b.capture;
    const pairFor = (values: IntentObservation[]) => {
      const first = values.find(a => a.tags.includes(candidate.tags[0]!) && values.some(b => independent(a, b) && b.tags.includes(candidate.tags[1]!)));
      const second = first && values.find(b => independent(first, b) && b.tags.includes(candidate.tags[1]!));
      return first && second ? [first, second] as const : undefined;
    };
    // Prefer actual measured demo interactions once both sources are available.
    // Until then, preserve the complete replay/external connection and its binding.
    const pair = pairFor(external.filter(value => !!value.capture)) ?? pairFor(external);
    const first = pair?.[0], second = pair?.[1];
    if (!first || !second) return [];
    // Replays and measured browsing describe alternative demonstrations of the same
    // weak context; never add their attention points together. Explicit commerce
    // actions remain shared evidence and can still change purchase readiness.
    const cohort = relevant.filter(value => !weak(value) || !!value.capture === !!first.capture);
    const ordered = [first, second, ...cohort.filter(value => value !== first && value !== second)];
    const counted: IntentObservation[] = [];
    const weakSites = new Set<string>();
    for (const value of ordered) {
      if (weak(value)) { const key = sourceIdentity(value) ?? site(value.sourceOrigin); if (weakSites.has(key)) continue; weakSites.add(key); }
      counted.push(value);
    }
    const evidencePoints = counted.reduce((sum, value) => sum + weights[value.action], 0);
    if (evidencePoints < 4) return [];
    const stored = feedback.get(candidate.id);
    const response = matchesSupport(stored, [first.id, second.id]) ? stored : undefined;
    const corrected = response?.action === 'correct' ? response.correction : undefined;
    const recommendationKey = corrected ?? candidate.recommendationKey;
    const label = corrected === 'home-meal-prep' ? 'Meal prep at home' : corrected === 'work-calls' ? 'Better work calls' : candidate.label;
    // A pledge for carrying lunch should not imply readiness for a corrected at-home need.
    const readinessEvidence = relevant.filter(value => corrected === 'home-meal-prep' ? !value.tags.includes('portable') : corrected === 'work-calls' ? !value.tags.includes('recording') : true);
    const readiness: IntentHypothesis['readiness'] = readinessEvidence.some(value => value.action === 'cart') ? 'ready_to_review'
      : readinessEvidence.some(value => value.action === 'group_interest') ? 'conditional'
      : readinessEvidence.some(value => ['save', 'wishlist'].includes(value.action)) ? 'considering' : 'exploring';
    const fixture = counted.some(value => value.provenance === 'demo_fixture');
    return [{ id: candidate.id, label, question: candidate.question, recommendationKey, readiness,
      connection: connectionFor(first, second, recommendationKey, response),
      interest: response?.action === 'confirm' || corrected ? 'confirmed' : 'tentative',
      status: response?.action === 'dismiss' ? 'dismissed' : 'active', evidencePoints,
      evidenceIds: counted.map(value => value.id), constraints: response?.constraints,
      explanation: `${counted.map(value => `${value.action} on ${value.capture ? `demo source ${value.capture.sourceId} (${site(value.sourceOrigin)})` : site(value.sourceOrigin)}: ${value.summary}`).join('; ')}. ${evidencePoints} heuristic evidence points, not a purchase probability. ${fixture ? counted.some(value => value.capture) ? 'Includes measured cursor interactions on controlled demo sources, not verified external browsing.' : 'Includes labeled demo fixture evidence.' : 'Based on opted-in observed interactions.'}${corrected ? ' User corrected the inferred need.' : ''}`,
    } satisfies IntentHypothesis];
  });
}
