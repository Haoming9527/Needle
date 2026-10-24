import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import type { ServerConfig } from '../server/config.js';
import type { IntentState } from '../shared/intent.js';
import type { Offer, SearchResponse } from '../shared/types.js';
const config: ServerConfig = { exaKey: '', openAiKey: '', gatewayKey: '', model: 'test', defaultMode: 'sample', timeoutMs: 5000, databaseFile: ':memory:', orderFile: null };
const apps: ReturnType<typeof createApp>[] = [];
function setup() { const app = createApp({ config }); apps.push(app); return request(app); }
type Client = ReturnType<typeof setup>;
const recipe = { id: 'recipe', action: 'dwell', sourceOrigin: 'https://recipes.example', sourceTitle: 'Meal preparation', summary: 'Meal-prep recipes for weekdays', tags: ['meal-prep'], provenance: 'demo_fixture' };
const cycling = { id: 'cycling', action: 'revisit', sourceOrigin: 'https://cycling.example', sourceTitle: 'Cycle commuting', summary: 'Cycling to work tips', tags: ['cycle-commute'], provenance: 'demo_fixture' };
async function state(api: Client): Promise<IntentState> { return (await api.get('/intent').expect(200)).body; }
async function seed(api: Client) { await api.post('/intent/consent').send({ enabled: true }).expect(200); await api.post('/intent/observations').send(recipe).expect(200); await api.post('/intent/observations').send(cycling).expect(200); }
async function discover(api: Client, text = 'portable lunch container'): Promise<SearchResponse> { return (await api.post('/discover').send({ mode: 'sample', selection: { text } }).expect(200)).body; }
function saved(offer: Offer) { return { id: `product:${offer.id}`, label: offer.title, summary: offer.description, sourceOrigin: 'https://needle.local', sourceTitle: 'Needle recommendation', tags: ['meal-prep', 'portable'], provenance: 'observed', offer }; }
afterEach(() => apps.splice(0).forEach(app => app.locals.database.close()));

describe('connected discovery, collections and conditional demand', () => {
  it('requires opt-in and cannot invent cross-site interests from a local recommendation', async () => {
    const api = setup(); expect((await state(api)).consent).toBe(false);
    await api.post('/intent/observations').send(recipe).expect(409);
    const offer = (await discover(api)).offers[0]!;
    await api.post('/saved-items').send(saved(offer)).expect(200);
    expect((await state(api)).observations).toEqual([]);
    await api.post('/intent/consent').send({ enabled: true }).expect(200);
    await api.post('/intent/observations').send(cycling).expect(200);
    await api.post('/saved-items').send(saved(offer)).expect(200);
    expect((await state(api)).hypotheses).toEqual([]);
    await api.post('/intent/observations').send(recipe).expect(200);
    expect((await state(api)).hypotheses[0]?.id).toBe('lunch-on-the-move');
  });

  it('confirms or corrects a tentative need and retrieves distinct grounded product sets', async () => {
    const api = setup(); await seed(api);
    expect((await state(api)).hypotheses[0]).toMatchObject({ readiness: 'exploring', interest: 'tentative', evidencePoints: 4 });
    const confirmed = await api.post('/intent/hypotheses/lunch-on-the-move/feedback').send({ action: 'confirm', constraints: 'Fits a commuter bag' }).expect(200);
    expect(confirmed.body.hypotheses[0]).toMatchObject({ interest: 'confirmed', recommendationKey: 'portable-lunch', readiness: 'exploring' });
    const portable = await discover(api);
    expect(portable.offers).toHaveLength(3);
    expect(portable.offers.every(offer => offer.id.startsWith('sample-lunch-') && offer.dataOrigin === 'sample')).toBe(true);
    const corrected = await api.post('/intent/hypotheses/lunch-on-the-move/feedback').send({ action: 'correct', correction: 'home-meal-prep', constraints: 'I eat at home' }).expect(200);
    expect(corrected.body.hypotheses[0]).toMatchObject({ recommendationKey: 'home-meal-prep', constraints: 'I eat at home', readiness: 'exploring' });
    const storage = await discover(api, 'food storage container');
    expect(storage.offers).toHaveLength(3);
    expect(storage.offers.every(offer => offer.id.startsWith('sample-storage-'))).toBe(true);
  });

  it('preserves constraints when correcting a need and ignores pledges for the rejected use case', async () => {
    const api = setup(); await seed(api);
    await api.post('/intent/hypotheses/lunch-on-the-move/feedback').send({ action: 'confirm', constraints: 'Under KRW 30,000' }).expect(200);
    const offer = (await discover(api)).offers[0]!, item = saved(offer);
    await api.post('/saved-items').send(item).expect(200);
    const campaign = (await api.post('/group-buys').send({ savedItemId: item.id, targetParticipants: 3, targetPrice: 15000, currency: 'KRW' }).expect(200)).body.campaign;
    await api.post(`/group-buys/${campaign.id}/join`).send({ maxPrice: 15000, currency: 'KRW' }).expect(200);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('conditional');
    const corrected = await api.post('/intent/hypotheses/lunch-on-the-move/feedback').send({ action: 'correct', correction: 'home-meal-prep' }).expect(200);
    expect(corrected.body.hypotheses[0]).toMatchObject({ recommendationKey: 'home-meal-prep', constraints: 'Under KRW 30,000', readiness: 'exploring' });
    const storage = await discover(api, 'food storage container; Under KRW 30,000');
    expect(storage.offers.length).toBeGreaterThan(0);
    expect(storage.offers.every(offer => offer.id.startsWith('sample-storage-') && offer.price !== null && offer.price < 30000)).toBe(true);
  });

  it('moves from collection to conditional pledge to cart and retracts actions even with memory paused', async () => {
    const api = setup(); await seed(api);
    const result = await discover(api), offer = result.offers[0]!, item = saved(offer);
    await api.post('/saved-items').send(item).expect(200);
    const collection = (await api.post('/collections').send({ name: 'Lunch plans' }).expect(200)).body.collection;
    const points = (await state(api)).hypotheses[0]!.evidencePoints;
    await api.post(`/collections/${collection.id}/items`).send({ savedItemId: item.id }).expect(200);
    expect((await state(api)).hypotheses[0]).toMatchObject({ evidencePoints: points, readiness: 'considering' });
    const campaign = (await api.post('/group-buys').send({ savedItemId: item.id, targetParticipants: 3, targetPrice: 15000, currency: 'KRW' }).expect(200)).body.campaign;
    expect(campaign).toMatchObject({ syntheticParticipants: 2, localPledge: null, eligibleParticipants: 2 });
    expect((await state(api)).hypotheses[0]!.evidencePoints).toBe(points);
    await api.post(`/group-buys/${campaign.id}/join`).send({ maxPrice: 15000, currency: 'KRW' }).expect(200);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('conditional');
    const cart = (await api.post('/cart').send({ sessionId: result.sessionId, offerId: offer.id, variant: offer.variants[0] }).expect(200)).body.items[0];
    expect((await state(api)).hypotheses[0]?.readiness).toBe('ready_to_review');
    await api.post(`/cart/${cart.id}/remove`).send({}).expect(200);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('conditional');
    await api.post('/intent/consent').send({ enabled: false }).expect(200);
    await api.post(`/group-buys/${campaign.id}/leave`).send({}).expect(200);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('considering');
    await api.post(`/saved-items/${encodeURIComponent(item.id)}/remove`).send({}).expect(200);
    expect((await state(api)).hypotheses[0]).toMatchObject({ readiness: 'exploring', evidencePoints: 4 });
  });

  it.each([true, false])('clear cart retracts readiness while consent is %s', async enabled => {
    const api = setup(); await seed(api);
    const result = await discover(api), offer = result.offers[0]!;
    await api.post('/cart').send({ sessionId: result.sessionId, offerId: offer.id, variant: offer.variants[0] }).expect(200);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('ready_to_review');
    await api.post('/intent/consent').send({ enabled }).expect(200);
    await api.post('/cart/clear').send({ unexpected: true }).expect(400);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('ready_to_review');
    expect((await api.post('/cart/clear').send({}).expect(200)).body.items).toEqual([]);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('exploring');
    await api.post('/cart/clear').send({}).expect(200);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('exploring');
  });

  it('supports remove-and-save-again without duplicate score inflation or stale tombstones', async () => {
    const api = setup(); await seed(api); const item = saved((await discover(api)).offers[0]!);
    await api.post('/saved-items').send(item).expect(200);
    const first = await state(api);
    await api.post('/saved-items').send(item).expect(200);
    expect((await state(api)).hypotheses[0]!.evidencePoints).toBe(first.hypotheses[0]!.evidencePoints);
    await api.post(`/saved-items/${encodeURIComponent(item.id)}/remove`).send({}).expect(200);
    expect((await state(api)).hypotheses[0]?.readiness).toBe('exploring');
    await api.post('/saved-items').send(item).expect(200);
    const restored = await state(api);
    expect(restored.hypotheses[0]).toMatchObject({ readiness: 'considering', evidencePoints: first.hypotheses[0]!.evidencePoints });
    expect(restored.observations).toHaveLength(first.observations.length);
  });
});
