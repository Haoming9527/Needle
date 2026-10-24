import { afterEach, describe, expect, it } from 'vitest';
import { evaluateIntent, IntentStore } from '../server/intent.js';
import { DatabaseSync } from 'node:sqlite';
import type { IntentFeedback, IntentObservation } from '../shared/intent.js';
const meal: IntentObservation = { id: 'meal', action: 'dwell', sourceOrigin: 'https://recipes.example', sourceTitle: 'Meal preparation guide', summary: 'Paused on a meal-preparation guide.', tags: ['meal-prep'], provenance: 'demo_fixture', createdAt: '2026-10-25T00:00:00.000Z' };
const commute: IntentObservation = { ...meal, id: 'commute', action: 'revisit', sourceOrigin: 'https://cycling.example', sourceTitle: 'Bicycle commuting guide', summary: 'Revisited a bicycle-commuting guide.', tags: ['cycle-commute'], provenance: 'observed' };
const observations = [meal, commute];
const feedback = (value: IntentFeedback) => new Map([['lunch-on-the-move', { ...value, supportingObservationIds: ['meal', 'commute'] }]]);

describe('observations versus inferred needs', () => {
  it('separates two browsing observations from a tentative non-shopping inference', () => {
    const hypothesis = evaluateIntent(observations)[0]!;
    expect(hypothesis).toMatchObject({ interest: 'tentative', readiness: 'exploring' });
    expect(hypothesis.connection.observations).toEqual([
      { observationId: 'meal', sourceTitle: meal.sourceTitle, action: 'dwell', summary: meal.summary, provenance: 'demo_fixture' },
      { observationId: 'commute', sourceTitle: commute.sourceTitle, action: 'revisit', summary: commute.summary, provenance: 'observed' },
    ]);
    expect(hypothesis.connection.inferredNeed).toEqual({ text: 'Carrying prepared meals during a commute might be useful.', basis: 'hypothesis' });
    expect(hypothesis.connection.uncertainty).toContain('do not establish');
    expect(hypothesis.connection.question).toContain('useful to you');
    expect(hypothesis.connection).not.toHaveProperty('productRationale');
  });
  it('does not infer a need from repeated same-site browsing or unrelated topics', () => {
    expect(evaluateIntent([meal, { ...commute, sourceOrigin: meal.sourceOrigin }])).toEqual([]);
    expect(evaluateIntent([meal, { ...commute, tags: ['audio', 'portable', 'small-space'] }])).toEqual([]);
  });
  it('does not add noisy or local commerce observations to the causal connection', () => {
    const original = evaluateIntent(observations)[0]!.connection;
    const noise: IntentObservation = { ...meal, id: 'noise', sourceOrigin: 'https://noise.example', tags: ['audio', 'portable', 'small-space'], summary: 'Browsed headphones and a compact bag.' };
    const local: IntentObservation = { ...meal, id: 'cart', action: 'cart', sourceOrigin: 'https://needle.local', tags: ['meal-prep', 'portable'] };
    const hypothesis = evaluateIntent([...observations, noise, local])[0]!;
    expect(hypothesis.connection).toEqual(original);
    expect(hypothesis.connection.observations.map(item => item.observationId)).toEqual(['meal', 'commute']);
    expect(hypothesis.readiness).toBe('ready_to_review');
  });
  it('adds rationale after confirmation without converting confirmation into shopping readiness', () => {
    const hypothesis = evaluateIntent(observations, feedback({ action: 'confirm' }))[0]!;
    expect(hypothesis).toMatchObject({ interest: 'confirmed', readiness: 'exploring' });
    expect(hypothesis.connection.inferredNeed.basis).toBe('user_confirmed');
    expect(hypothesis.connection.productRationale).toContain('need you confirmed');
    expect(hypothesis.connection.uncertainty).toContain('does not express a purchase decision');
  });
  it('attributes a corrected objective to user feedback while retaining historical observations faithfully', () => {
    const original = evaluateIntent(observations)[0]!.connection;
    const hypothesis = evaluateIntent(observations, feedback({ action: 'correct', correction: 'home-meal-prep' }))[0]!;
    expect(hypothesis.connection.observations).toEqual(original.observations);
    expect(hypothesis.connection.inferredNeed).toEqual({ text: 'You clarified that the useful need is preparing and storing food at home.', basis: 'user_corrected' });
    expect(hypothesis.connection.productRationale).toContain('commuting observation is not a reason');
    expect(hypothesis.connection.question).toContain('at home');
    expect(hypothesis.readiness).toBe('exploring');
  });
});


const databases: DatabaseSync[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function memory() {
  const db = new DatabaseSync(':memory:'); databases.push(db);
  const store = new IntentStore(db); store.setConsent(true);
  store.record(meal); store.record(commute);
  return { db, store };
}
describe('feedback belongs to its supporting observations', () => {
  it('requires reconfirmation after a supporting observation is removed and re-added', () => {
    const { store } = memory();
    store.feedback('lunch-on-the-move', { action: 'confirm', constraints: 'under KRW 30,000' });
    store.remove('meal');
    expect(store.getState().hypotheses).toEqual([]);
    const restored = store.record({ ...meal, id: 'meal-new' }).hypotheses[0]!;
    expect(restored.interest).toBe('tentative');
    expect(restored.constraints).toBeUndefined();
    expect(restored.connection.productRationale).toBeUndefined();
    expect(store.feedback('lunch-on-the-move', { action: 'confirm' }).hypotheses[0]?.constraints).toBeUndefined();
  });
  it('does not reuse old confirmation when a retracted source is replaced by a different supporting pair', () => {
    const { store } = memory();
    store.feedback('lunch-on-the-move', { action: 'correct', correction: 'home-meal-prep', constraints: 'At home only' });
    store.record({ ...meal, id: 'other-source', sourceOrigin: 'https://another-recipes.example' });
    store.retractAction(meal.sourceOrigin, meal.summary.trim().toLowerCase(), 'dwell');
    const changed = store.getState().hypotheses[0]!;
    expect(changed).toMatchObject({ interest: 'tentative', recommendationKey: 'portable-lunch' });
    expect(changed.connection.observations.map(value => value.observationId)).toEqual(['other-source', 'commute']);
    expect(changed.constraints).toBeUndefined();
  });
  it('preserves constraints for the same pair while rejecting confirm and correct when memory is paused', () => {
    const { store } = memory();
    store.feedback('lunch-on-the-move', { action: 'confirm', constraints: 'Under KRW 30,000' });
    expect(store.feedback('lunch-on-the-move', { action: 'correct', correction: 'home-meal-prep' }).hypotheses[0]?.constraints).toBe('Under KRW 30,000');
    store.setConsent(false);
    expect(() => store.feedback('lunch-on-the-move', { action: 'confirm' })).toThrow('Enable context memory');
    expect(() => store.feedback('lunch-on-the-move', { action: 'correct', correction: 'home-meal-prep' })).toThrow('Enable context memory');
    expect(store.feedback('lunch-on-the-move', { action: 'dismiss' }).hypotheses[0]?.status).toBe('dismissed');
  });
  it('safely ignores legacy unbound feedback without removing observations', () => {
    const { db, store } = memory();
    db.prepare('INSERT INTO intent_feedback VALUES (?,?)').run('lunch-on-the-move', JSON.stringify({ action: 'confirm', constraints: 'Old constraints' }));
    const state = store.getState();
    expect(state.observations).toHaveLength(2);
    expect(state.hypotheses[0]?.interest).toBe('tentative');
    expect(state.hypotheses[0]?.constraints).toBeUndefined();
    expect(store.feedback('lunch-on-the-move', { action: 'confirm' }).hypotheses[0]?.constraints).toBeUndefined();
  });
});
