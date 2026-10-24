import type { DatabaseSync } from 'node:sqlite';
import type { IntentAction, IntentConnection, IntentFeedback, IntentHypothesis, IntentObservation, IntentObservationInput, IntentState, IntentTag } from '../shared/intent.js';
import { ApiError } from './errors.js';

const weights = { dwell: 2, revisit: 2, find: 3, save: 4, wishlist: 4, group_interest: 4, cart: 5 };
const strength = { dwell: 0, revisit: 1, find: 2, save: 3, wishlist: 4, group_interest: 5, cart: 6 };
const weak = (value: IntentObservation) => value.action === 'dwell' || value.action === 'revisit';
const site = (origin: string) => new URL(origin).hostname.replace(/^www\./, '');
const semanticKey = (value: IntentObservationInput) => `${site(value.sourceOrigin)}:${value.entityKey ?? value.summary.trim().toLowerCase().replace(/\s+/g, ' ')}`;
const parse = <T>(data: unknown): T => JSON.parse(String(data)) as T;

/** Bounded reasoning templates keep captured actions distinct from proposed needs. */
function connectionFor(first: IntentObservation, second: IntentObservation, key: IntentHypothesis['recommendationKey'], response?: IntentFeedback): IntentConnection {
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
    observations: [first, second].map(value => ({ observationId: value.id, sourceTitle: value.sourceTitle, action: value.action, summary: value.summary, provenance: value.provenance })),
    inferredNeed: { text: confirmed ? template.confirmed : template.tentative, basis: corrected ? 'user_corrected' : confirmed ? 'user_confirmed' : 'hypothesis' },
    uncertainty: confirmed ? `${corrected ? template.uncertainty + ' ' : ''}Confirming a useful need does not express a purchase decision.` : template.uncertainty,
    question: template.question,
    ...(confirmed ? { productRationale: template.rationale } : {}),
  };
}

/** Local single-user evidence memory. Scores are explainable heuristic points, never probabilities. */
export class IntentStore {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS intent_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_observations (id TEXT PRIMARY KEY, semantic_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_events (id TEXT PRIMARY KEY, semantic_key TEXT NOT NULL, action TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS intent_event_entity ON intent_events(semantic_key);
      CREATE TABLE IF NOT EXISTS intent_seen (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS intent_feedback (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
    // Upgrade prior aggregate-only databases without changing canonical observation IDs.
    for (const row of db.prepare('SELECT id,semantic_key,data FROM intent_observations').all()) {
      if (!db.prepare('SELECT id FROM intent_events WHERE semantic_key=? LIMIT 1').get(row.semantic_key)) {
        const previous = parse<IntentObservation>(row.data);
        db.prepare('INSERT OR IGNORE INTO intent_events VALUES (?,?,?,?)').run(previous.id, String(row.semantic_key), previous.action, JSON.stringify(previous));
      }
    }
  }
  getState(): IntentState {
    const consent = this.db.prepare("SELECT value FROM intent_settings WHERE key='consent'").get()?.value === 'true';
    const observations = this.db.prepare('SELECT data FROM intent_observations ORDER BY rowid').all().map(row => parse<IntentObservation>(row.data));
    const feedback = new Map(this.db.prepare('SELECT id,data FROM intent_feedback').all().map(row => [String(row.id), parse<IntentFeedback>(row.data)]));
    return { consent, observations, hypotheses: evaluateIntent(observations, feedback) };
  }
  setConsent(enabled: boolean): IntentState {
    this.db.prepare("INSERT INTO intent_settings VALUES ('consent',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(enabled));
    return this.getState();
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
    const strongest = events.reduce((best, event) => strength[event.action] > strength[best.action] ? event : best, first);
    const next: IntentObservation = {
      ...first, id: previous?.id ?? first.id, createdAt: previous?.createdAt ?? first.createdAt,
      action: strongest.action,
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
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
  feedback(id: string, input: IntentFeedback): IntentState {
    if (!this.getState().hypotheses.some(value => value.id === id)) throw new ApiError(404, 'INTENT_NOT_FOUND', 'That interest is no longer available.');
    if (input.action === 'correct' && !input.correction) throw new ApiError(400, 'CORRECTION_REQUIRED', 'Choose the corrected need.');
    if (input.action === 'correct' && ((id === 'lunch-on-the-move' && input.correction !== 'home-meal-prep') || (id === 'recording-setup' && input.correction !== 'work-calls'))) throw new ApiError(400, 'INVALID_CORRECTION', 'Choose a correction relevant to this interest.');
    const previous = this.db.prepare('SELECT data FROM intent_feedback WHERE id=?').get(id);
    const prior = previous ? parse<IntentFeedback>(previous.data) : undefined;
    const updated = { ...input, constraints: input.constraints ?? prior?.constraints };
    this.db.prepare('INSERT INTO intent_feedback VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id, JSON.stringify(updated));
    return this.getState();
  }
  remove(id: string): IntentState {
    const row = this.db.prepare('SELECT semantic_key FROM intent_observations WHERE id=?').get(id);
    if (!row) return this.getState();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM intent_events WHERE semantic_key=?').run(row.semantic_key);
      this.db.prepare('DELETE FROM intent_observations WHERE id=?').run(id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
  reset(): IntentState {
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.exec('DELETE FROM intent_events; DELETE FROM intent_observations; DELETE FROM intent_feedback; DELETE FROM intent_seen; DELETE FROM intent_settings; COMMIT;'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
}

export function evaluateIntent(observations: IntentObservation[], feedback = new Map<string, IntentFeedback>()): IntentHypothesis[] {
  const candidates = [
    { id: 'lunch-on-the-move', label: 'Lunch on the move', question: 'Are you looking for a way to bring your meal prep on your cycle commute?', tags: ['meal-prep', 'cycle-commute'] as IntentTag[], recommendationKey: 'portable-lunch' as const },
    { id: 'recording-setup', label: 'A recording setup', question: 'Are you putting together a home recording setup?', tags: ['recording', 'audio'] as IntentTag[], recommendationKey: 'recording' as const },
  ];
  return candidates.flatMap(candidate => {
    const relevant = observations.filter(value => value.tags.some(tag => candidate.tags.includes(tag)));
    // Require complementary evidence across two sites, not two repetitions of the same topic.
    const external = relevant.filter(value => !['localhost', '127.0.0.1', '[::1]', 'needle.local'].includes(site(value.sourceOrigin)) && !site(value.sourceOrigin).endsWith('.localhost'));
    const first = external.find(a => a.tags.includes(candidate.tags[0]!) && external.some(b => site(a.sourceOrigin) !== site(b.sourceOrigin) && b.tags.includes(candidate.tags[1]!)));
    const second = first && external.find(b => site(first.sourceOrigin) !== site(b.sourceOrigin) && b.tags.includes(candidate.tags[1]!));
    if (!first || !second) return [];
    const ordered = [first, second, ...relevant.filter(value => value !== first && value !== second)];
    const counted: IntentObservation[] = [];
    const weakSites = new Set<string>();
    for (const value of ordered) {
      if (weak(value)) { if (weakSites.has(site(value.sourceOrigin))) continue; weakSites.add(site(value.sourceOrigin)); }
      counted.push(value);
    }
    const evidencePoints = counted.reduce((sum, value) => sum + weights[value.action], 0);
    if (evidencePoints < 4) return [];
    const response = feedback.get(candidate.id);
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
      explanation: `${counted.map(value => `${value.action} on ${site(value.sourceOrigin)}: ${value.summary}`).join('; ')}. ${evidencePoints} heuristic evidence points, not a purchase probability. ${fixture ? 'Includes labeled demo fixture evidence.' : 'Based on opted-in observed interactions.'}${corrected ? ' User corrected the inferred need.' : ''}`,
    } satisfies IntentHypothesis];
  });
}
