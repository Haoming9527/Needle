import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { IntentStore } from '../server/intent.js';
import { intentSuggestionKey, type IntentObservationInput } from '../shared/intent.js';
import type { SynthesisOutput } from '../shared/synthesis.js';
import { DEMO_ATTENTION_SOURCES } from '../shared/attention.js';
const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const first: IntentObservationInput = { id: 'bird', action: 'dwell', sourceOrigin: 'https://bird-guide.example', sourceTitle: 'Bird watching', summary: 'Looked at a guide to observing birds from a distance.', tags: [], provenance: 'observed', entityKey: 'bird-guide' };
const second: IntentObservationInput = { id: 'hike', action: 'revisit', sourceOrigin: 'https://walks.example', sourceTitle: 'Quiet walking trails', summary: 'Returned to walking routes near a nature reserve.', tags: [], provenance: 'observed', entityKey: 'walk-guide' };
const output: SynthesisOutput = { outcome: 'hypothesis', label: 'Watching wildlife outdoors', need: 'Observing wildlife at a distance might be useful.', why: 'The bird guide and nature-reserve routes may share an outdoor observation interest.', uncertainty: 'Browsing does not establish that you will take this trip or want to buy anything.', question: 'Would observing wildlife on your walks be useful?', productQuery: 'compact birdwatching binoculars', evidence: [{ observationId: 'bird', reason: 'A guide about watching birds.' }, { observationId: 'hike', reason: 'Routes in a nature reserve.' }] };
const abstention: SynthesisOutput = { outcome: 'abstain', label: null, need: null, why: null, uncertainty: 'The observations do not support a shared need.', question: null, productQuery: null, evidence: [] };
function setup() {
  const db = new DatabaseSync(':memory:'); databases.push(db); const store = new IntentStore(db);
  store.configureSynthesis({ available: true, model: 'test-model', promptVersion: 'test-v1' }); store.setConsent(true); store.record(first); store.record(second);
  return { db, store };
}
function save(store: IntentStore, result = output, correction?: string) { return store.saveSynthesis(store.synthesisSnapshot().contextKey, result, correction); }

describe('persisted grounded context synthesis', () => {
  it('supports unknown needs with empty tags and canonical source facts, and binds confirmation without self-invalidating', () => {
    const { db, store } = setup(); const snapshot = store.synthesisSnapshot();
    expect(snapshot.observations.map(item => item.id)).toEqual(['bird', 'hike']);
    const state = save(store); const hypothesis = state.hypotheses[0]!;
    expect(state.synthesis?.status).toBe('ready');
    expect(hypothesis).toMatchObject({ recommendationKey: 'contextual', interest: 'tentative', readiness: 'exploring', origin: { kind: 'model', model: 'test-model', evidenceFingerprint: snapshot.contextKey, productQuery: output.productQuery } });
    expect(hypothesis.connection.observations[0]?.summary).toBe(first.summary);
    expect(hypothesis.connection.why).toBe(output.why);
    expect(hypothesis.connection.productRationale).toBeUndefined();
    const confirmed = store.feedback(hypothesis.id, { action: 'confirm', constraints: 'Under USD 100' }).hypotheses[0]!;
    expect(store.synthesisSnapshot().contextKey).toBe(snapshot.contextKey);
    expect(confirmed).toMatchObject({ interest: 'confirmed', readiness: 'exploring' });
    expect(intentSuggestionKey(confirmed)).toContain(output.productQuery);
    const reopened = new IntentStore(db); reopened.configureSynthesis({ available: true, model: 'test-model', promptVersion: 'test-v1' });
    expect(reopened.getState().hypotheses[0]?.interest).toBe('confirmed');
  });
  it('rejects unknown, duplicate and same-source evidence IDs without persisting a result', () => {
    const { store } = setup();
    expect(() => save(store, { ...output, evidence: [{ observationId: 'unknown', reason: 'Invented' }, output.evidence[0]!] })).toThrow('grounded');
    expect(() => save(store, { ...output, evidence: [output.evidence[0]!, output.evidence[0]!] })).toThrow('grounded');
    store.record({ ...first, id: 'same-site', entityKey: 'another-bird-guide' });
    expect(() => save(store, { ...output, evidence: [output.evidence[0]!, { observationId: 'same-site', reason: 'Same site' }] })).toThrow('grounded');
    expect(store.getState().synthesis?.status).toBe('idle');
  });
  it('invalidates results on same-ID content changes and rejects old fingerprints', () => {
    const { store } = setup(); const before = store.synthesisSnapshot(); const ai = save(store).hypotheses[0]!;
    store.feedback(ai.id, { action: 'confirm' });
    store.record({ ...first, id: 'changed-event', summary: 'Now reading about caring for a pet bird.' });
    expect(store.synthesisSnapshot().contextKey).not.toBe(before.contextKey);
    expect(store.getState()).toMatchObject({ synthesis: { status: 'stale' }, hypotheses: [] });
    expect(() => store.saveSynthesis(before.contextKey, output)).toThrow('context changed');
    expect(save(store).hypotheses[0]?.interest).toBe('tentative');
  });
  it('invalidates pause/resume and retains monotonic revisions across feedback and reset', () => {
    const { store } = setup(); const before = store.synthesisSnapshot(); const ai = save(store).hypotheses[0]!;
    const revision = store.synthesisRevision(); store.feedback(ai.id, { action: 'dismiss' });
    expect(store.synthesisRevision()).toBeGreaterThan(revision);
    store.setConsent(false); expect(() => save(store)).toThrow('Enable context memory');
    store.setConsent(true); expect(store.synthesisSnapshot().contextKey).not.toBe(before.contextKey);
    expect(store.getState().synthesis?.status).toBe('stale');
    const last = store.synthesisRevision(); store.reset();
    expect(store.synthesisRevision()).toBeGreaterThan(last);
    expect(store.getState().synthesis?.status).toBe('idle');
  });
  it('suppresses rule fallbacks for abstention and stale model output', () => {
    const { store } = setup();
    store.record({ ...first, id: 'recipe', entityKey: 'recipe', tags: ['meal-prep'] });
    store.record({ ...second, id: 'commute', entityKey: 'commute', tags: ['cycle-commute'] });
    expect(store.getState().hypotheses.some(item => item.id === 'lunch-on-the-move')).toBe(true);
    expect(save(store, abstention)).toMatchObject({ synthesis: { status: 'abstained' }, hypotheses: [] });
    store.record({ ...first, id: 'new-bird', entityKey: 'new-bird' });
    expect(store.getState()).toMatchObject({ synthesis: { status: 'stale' }, hypotheses: [] });
  });
  it('prefers complete measured sources without mixing cohorts, excludes local commerce, and bounds the projection', () => {
    const { store } = setup(); store.setAttentionConsent(true);
    for (const source of Object.values(DEMO_ATTENTION_SOURCES)) store.recordAttention({ id: randomUUID(), sessionId: randomUUID(), pageInstanceId: randomUUID(), sourceId: source.id, targetId: source.targetId, action: 'dwell', measurement: { dwellMs: 2000, visitOrdinal: 1 }, capturedAt: new Date().toISOString(), documentUrl: `http://localhost:5173${source.path}` });
    store.record({ ...first, id: 'local-cart', sourceOrigin: 'https://needle.local', action: 'cart' });
    const measured = store.synthesisSnapshot();
    expect(measured.observations).toHaveLength(2);
    expect(measured.observations.every(item => item.sourceKey.startsWith('demo:'))).toBe(true);
    expect(() => save(store, output)).toThrow('grounded');
    const { store: another } = setup();
    for (let i = 0; i < 20; i++) another.record({ ...first, id: `extra-${i}`, entityKey: `extra-${i}` });
    const bounded = another.synthesisSnapshot(); expect(bounded.observations).toHaveLength(12);
    expect(new Set(bounded.observations.map(item => item.sourceKey)).size).toBe(2);
  });
  it('produces new tentative identities for corrected model output and requires the synthesis correction path', () => {
    const { store } = setup(); const original = save(store).hypotheses[0]!; store.feedback(original.id, { action: 'confirm' });
    expect(() => store.feedback(original.id, { action: 'correct', correction: 'home-meal-prep' })).toThrow('Reconsider');
    const changed = save(store, { ...output, label: 'Looking at scenery', productQuery: 'compact travel binoculars' }, 'I prefer scenery to birds').hypotheses[0]!;
    expect(changed.id).not.toBe(original.id); expect(changed.interest).toBe('tentative');
    expect(changed.connection.uncertainty).toContain('correction');
    expect(changed.connection.productRationale).toBeUndefined();
    const confirmed = store.feedback(changed.id, { action: 'confirm' }).hypotheses[0]!;
    expect(confirmed.connection.inferredNeed.basis).toBe('user_corrected');
    expect(confirmed.connection.uncertainty).toContain('not a purchase decision');
  });
});
