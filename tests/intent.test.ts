import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { IntentStore } from '../server/intent.js';
import type { IntentObservationInput } from '../shared/intent.js';
const databases: DatabaseSync[] = [];
function setup() { const db = new DatabaseSync(':memory:'); databases.push(db); return { db, store: new IntentStore(db) }; }
const meal: IntentObservationInput = { id: 'meal', action: 'dwell', sourceOrigin: 'https://recipes.example', sourceTitle: 'Meal prep', summary: 'Meal preparation recipes', tags: ['meal-prep'], provenance: 'observed' };
const cycle: IntentObservationInput = { id: 'cycle', action: 'revisit', sourceOrigin: 'https://cycling.example', sourceTitle: 'Cycle commuting', summary: 'Bicycle commuting tips', tags: ['cycle-commute'], provenance: 'demo_fixture' };
afterEach(() => databases.splice(0).forEach(db => db.close()));
describe('local intent memory', () => {
  it('requires opt-in, persists memory across store instances, and reset clears consent', () => {
    const { store, db } = setup(); expect(store.getState().consent).toBe(false);
    expect(() => store.record(meal)).toThrow('Enable context memory');
    store.setConsent(true); store.record(meal);
    expect(new IntentStore(db).getState().observations).toHaveLength(1);
    expect(store.reset()).toEqual({ consent: false, observations: [], hypotheses: [] });
  });
  it('stitches complementary weak evidence across sites without inventing purchase readiness', () => {
    const { store } = setup(); store.setConsent(true); store.record(meal);
    expect(store.getState().hypotheses).toEqual([]);
    const result = store.record(cycle).hypotheses[0]!;
    expect(result).toMatchObject({ id: 'lunch-on-the-move', evidencePoints: 4, readiness: 'exploring', interest: 'tentative', recommendationKey: 'portable-lunch' });
    expect(result.explanation).toContain('demo fixture');
    expect(result.explanation).toContain('not a purchase probability');
    expect(result.evidenceIds).toEqual(['meal', 'cycle']);
  });
  it('does not infer an interest from unrelated evidence or same-site repetition', () => {
    const { store } = setup(); store.setConsent(true); store.record(meal);
    store.record({ ...cycle, tags: ['audio'] });
    expect(store.getState().hypotheses).toEqual([]);
    store.record({ ...cycle, id: 'same-site', sourceOrigin: meal.sourceOrigin });
    expect(store.getState().hypotheses).toEqual([]);
  });
  it('deduplicates IDs and semantic evidence, and collection attachment does not inflate scores', () => {
    const { store } = setup(); store.setConsent(true); store.record({ ...meal, entityKey: 'recipe' });
    store.record({ ...meal, action: 'cart', entityKey: 'recipe' });
    store.record({ ...meal, id: 'save', action: 'save', entityKey: 'recipe' });
    store.record({ ...meal, id: 'collection', action: 'save', entityKey: 'recipe', collectionId: 'ideas' });
    const state = store.record(cycle);
    expect(state.observations).toHaveLength(2);
    expect(state.observations[0]).toMatchObject({ id: 'meal', action: 'save', collectionId: 'ideas' });
    expect(state.hypotheses[0]).toMatchObject({ evidencePoints: 6, readiness: 'considering' });
  });
  it('caps weak events per site', () => {
    const { store } = setup(); store.setConsent(true); store.record(meal); store.record(cycle);
    store.record({ ...meal, id: 'extra', summary: 'Another recipe' });
    expect(store.getState().hypotheses[0]?.evidencePoints).toBe(4);
  });
  it('dismisses, corrects recommendations, records constraints, and recomputes after removal', () => {
    const { store } = setup(); store.setConsent(true); store.record(meal); store.record(cycle);
    expect(store.feedback('lunch-on-the-move', { action: 'dismiss' }).hypotheses[0]?.status).toBe('dismissed');
    const corrected = store.feedback('lunch-on-the-move', { action: 'correct', correction: 'home-meal-prep', constraints: 'No need to carry lunch' }).hypotheses[0]!;
    expect(corrected).toMatchObject({ recommendationKey: 'home-meal-prep', interest: 'confirmed', status: 'active', readiness: 'exploring', constraints: 'No need to carry lunch' });
    expect(() => store.feedback('lunch-on-the-move', { action: 'correct', correction: 'work-calls' })).toThrow('relevant');
    expect(store.remove('cycle').hypotheses).toEqual([]);
  });
  it('separates explicit conditional interest from passive readiness and supports recording', () => {
    const { store } = setup(); store.setConsent(true);
    store.record({ ...meal, tags: ['recording'] });
    store.record({ ...cycle, tags: ['audio'], action: 'group_interest' });
    expect(store.getState().hypotheses[0]).toMatchObject({ id: 'recording-setup', readiness: 'conditional' });
    expect(store.feedback('recording-setup', { action: 'correct', correction: 'work-calls' }).hypotheses[0]?.recommendationKey).toBe('work-calls');
  });
  it('strips path/query data from stored origins and refuses new evidence when consent is paused', () => {
    const { store } = setup(); store.setConsent(true);
    expect(store.record({ ...meal, sourceOrigin: 'https://recipes.example/path?secret=hidden' }).observations[0]?.sourceOrigin).toBe('https://recipes.example');
    store.setConsent(false); expect(() => store.record(cycle)).toThrow('Enable context memory');
    expect(store.getState().observations).toHaveLength(1);
  });
});
