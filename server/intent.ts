import type { DatabaseSync } from 'node:sqlite';
import type { IntentFeedback, IntentHypothesis, IntentObservation, IntentObservationInput, IntentState, IntentTag } from '../shared/intent.js';
import { ApiError } from './errors.js';

const weights = { dwell: 2, revisit: 2, find: 3, save: 4, wishlist: 4, group_interest: 4, cart: 5 };
const strength = { dwell: 0, revisit: 1, find: 2, save: 3, wishlist: 4, group_interest: 5, cart: 6 };
const weak = (value: IntentObservation) => value.action === 'dwell' || value.action === 'revisit';
const site = (origin: string) => new URL(origin).hostname.replace(/^www\./, '');
const semanticKey = (value: IntentObservationInput) => `${site(value.sourceOrigin)}:${value.entityKey ?? value.summary.trim().toLowerCase().replace(/\s+/g, ' ')}`;
const parse = <T>(data: unknown): T => JSON.parse(String(data)) as T;

/** Local single-user evidence memory. Scores are explainable heuristic points, never probabilities. */
export class IntentStore {
  constructor(private db: DatabaseSync) {
    db.exec(`CREATE TABLE IF NOT EXISTS intent_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_observations (id TEXT PRIMARY KEY, semantic_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS intent_seen (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS intent_feedback (id TEXT PRIMARY KEY, data TEXT NOT NULL);`);
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
    const row = this.db.prepare('SELECT data FROM intent_observations WHERE semantic_key=?').get(key);
    const previous = row ? parse<IntentObservation>(row.data) : undefined;
    const next: IntentObservation = previous ? {
      ...previous,
      action: strength[input.action] > strength[previous.action] ? input.action : previous.action,
      collectionId: input.collectionId ?? previous.collectionId,
      tags: [...new Set([...previous.tags, ...input.tags])],
      // Fixture evidence cannot become observed merely by merging it with another event.
      provenance: previous.provenance === 'demo_fixture' || input.provenance === 'demo_fixture' ? 'demo_fixture' : 'observed',
    } : { ...input, sourceOrigin: new URL(input.sourceOrigin).origin, createdAt: new Date().toISOString() };
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO intent_observations VALUES (?,?,?) ON CONFLICT(semantic_key) DO UPDATE SET data=excluded.data').run(next.id, key, JSON.stringify(next));
      this.db.prepare('INSERT INTO intent_seen VALUES (?)').run(input.id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return this.getState();
  }
  feedback(id: string, input: IntentFeedback): IntentState {
    if (!this.getState().hypotheses.some(value => value.id === id)) throw new ApiError(404, 'INTENT_NOT_FOUND', 'That interest is no longer available.');
    if (input.action === 'correct' && !input.correction) throw new ApiError(400, 'CORRECTION_REQUIRED', 'Choose the corrected need.');
    if (input.action === 'correct' && ((id === 'lunch-on-the-move' && input.correction !== 'home-meal-prep') || (id === 'recording-setup' && input.correction !== 'work-calls'))) throw new ApiError(400, 'INVALID_CORRECTION', 'Choose a correction relevant to this interest.');
    this.db.prepare('INSERT INTO intent_feedback VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id, JSON.stringify(input));
    return this.getState();
  }
  remove(id: string): IntentState {
    this.db.prepare('DELETE FROM intent_observations WHERE id=?').run(id);
    return this.getState();
  }
  reset(): IntentState {
    this.db.exec('BEGIN IMMEDIATE');
    try { this.db.exec('DELETE FROM intent_observations; DELETE FROM intent_feedback; DELETE FROM intent_seen; DELETE FROM intent_settings; COMMIT;'); }
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
    const first = relevant.find(a => a.tags.includes(candidate.tags[0]!) && relevant.some(b => site(a.sourceOrigin) !== site(b.sourceOrigin) && b.tags.includes(candidate.tags[1]!)));
    const second = first && relevant.find(b => site(first.sourceOrigin) !== site(b.sourceOrigin) && b.tags.includes(candidate.tags[1]!));
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
    const readiness: IntentHypothesis['readiness'] = relevant.some(value => value.action === 'cart') ? 'ready_to_review'
      : relevant.some(value => value.action === 'group_interest') ? 'conditional'
      : relevant.some(value => ['save', 'wishlist'].includes(value.action)) ? 'considering' : 'exploring';
    const fixture = counted.some(value => value.provenance === 'demo_fixture');
    return [{ id: candidate.id, label, question: candidate.question, recommendationKey, readiness,
      interest: response?.action === 'confirm' || corrected ? 'confirmed' : 'tentative',
      status: response?.action === 'dismiss' ? 'dismissed' : 'active', evidencePoints,
      evidenceIds: counted.map(value => value.id), constraints: response?.constraints,
      explanation: `${counted.map(value => `${value.action} on ${site(value.sourceOrigin)}: ${value.summary}`).join('; ')}. ${evidencePoints} heuristic evidence points, not a purchase probability. ${fixture ? 'Includes labeled demo fixture evidence.' : 'Based on opted-in observed interactions.'}${corrected ? ' User corrected the inferred need.' : ''}`,
    } satisfies IntentHypothesis];
  });
}
