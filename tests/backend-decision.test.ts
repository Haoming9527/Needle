import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app';
import type { ServerConfig } from '../server/config';
import type { ProductDecisionInput, ProductDecisionResult } from '../server/agent/product-decision';
import type { Interpretation, Offer, Selection } from '../shared/types';
import type { ProductProvider } from '../server/providers/types';

const config: ServerConfig = { exaKey: 'fixture', openAiKey: 'fixture', model: 'fixture', defaultMode: 'sample', timeoutMs: 45000, orderFile: null, databaseFile: ':memory:' };
const item: Interpretation = { name: 'Black headphones', productType: 'headphones', color: 'black', brand: null, model: null, attributes: [], queries: ['black headphones'], needsClarification: false, clarification: null };
const first: Offer = { id: 'first', title: 'White headphones', description: '', imageUrl: null, sourceUrl: null, match: 'similar', matchEvidence: 'Headphones', price: 10, currency: 'USD', observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'sample', variants: [], shipping: null, availability: null, returns: null, reason: 'A candidate', differences: [] };
const best: Offer = { ...first, id: 'best', title: 'Black headphones', price: 50, reason: 'Matches the selected color and shape.' };
const selection = { imageDataUrl: 'data:image/jpeg;base64,AAAA', annotatedImageDataUrl: 'data:image/jpeg;base64,BBBB', focus: { x: 0.1, y: 0.2 } };
const choose = async (_config: ServerConfig, input: ProductDecisionInput): Promise<ProductDecisionResult> => ({ offers: [input.offers[1], input.offers[0]], decision: { status: 'selected', offerId: input.offers[1].id, model: 'gpt-6-luna' }, warnings: [] });

describe('Decisions in the shopping workflow', () => {
  it.each(['catalog', 'live', 'web-fallback'] as const)('returns recommendations through %s discovery when brand/model are unknown', async source => {
    const decide = vi.fn(choose);
    const identify = vi.fn(async (_selection: Selection) => item);
    const sampleSearch = vi.fn(async () => ({ offers: source === 'web-fallback' ? [] : [first, best], warnings: [] }));
    const liveSearch = vi.fn(async () => ({ offers: [first, best], warnings: [] }));
    const webSearch = vi.fn(async () => ({ offers: [first, best], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify, search: sampleSearch }, liveProvider: { identify, search: liveSearch }, webDemoProvider: { identify, search: webSearch }, decisionProvider: decide });
    try {
      const found = await request(app).post('/discover').send({ selection, mode: source === 'live' ? 'live' : 'sample' }).expect(200);
      expect(found.body).toMatchObject({ offers: [best, first], interpretation: { brand: null, model: null, needsClarification: false, clarification: null }, decision: { status: 'selected' } });
      expect(decide).toHaveBeenCalledTimes(1);
      expect(webSearch).toHaveBeenCalledTimes(source === 'web-fallback' ? 1 : 0);
      expect(liveSearch).toHaveBeenCalledTimes(source === 'live' ? 1 : 0);
      expect(app.locals.database.session(found.body.sessionId).interpretation.needsClarification).toBe(false);
    } finally { app.locals.database.close(); }
  });

  it('uses the decision winner for discovery, refinement, and purchase without changing source facts', async () => {
    const decide = vi.fn(choose);
    const search = vi.fn(async () => ({ offers: [first, best], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify: async () => item, search }, decisionProvider: decide });
    try {
      const found = await request(app).post('/discover').send({ selection }).expect(200);
      expect(found.body.offers).toEqual([best, first]);
      expect(found.body.decision).toMatchObject({ status: 'selected', offerId: best.id });
      expect(decide.mock.calls[0][1].selection).toEqual(selection);
      const refined = await request(app).post('/refine').send({ sessionId: found.body.sessionId, instruction: 'Prefer comfortable ear pads' }).expect(200);
      expect(decide.mock.calls[1][1]).toMatchObject({ item, instruction: 'Prefer comfortable ear pads' });
      expect(refined.body.offers[0]).toEqual(best);
      const order = await request(app).post('/orders').send({ sessionId: refined.body.sessionId, offerId: best.id, confirmationId: 'decision-winner-check', confirmed: true }).expect(201);
      expect(order.body).toMatchObject({ title: best.title, price: 50, currency: 'USD' });
      expect(app.locals.database.session(found.body.sessionId).result.offers[0]).toEqual(best);
    } finally { app.locals.database.close(); }
  });

  it('waits for clarification before deciding, then uses the same marked crop and answer', async () => {
    const decide = vi.fn(choose);
    const identify = vi.fn().mockResolvedValueOnce({ ...item, needsClarification: true, clarification: 'Headphones or the lamp?' }).mockResolvedValueOnce(item);
    const app = createApp({ config, sampleProvider: { identify, search: async value => ({ offers: value.needsClarification ? [] : [first, best], warnings: [] }) }, decisionProvider: decide });
    try {
      const found = await request(app).post('/discover').send({ selection }).expect(200);
      expect(decide).not.toHaveBeenCalled();
      const answer = await request(app).post('/clarify').send({ sessionId: found.body.sessionId, selection, answer: 'The headphones' }).expect(200);
      expect(answer.body.offers[0]).toEqual(best);
      expect(decide.mock.calls[0][1].selection).toMatchObject({ ...selection, clarifications: [{ question: 'Headphones or the lamp?', answer: 'The headphones' }] });
    } finally { app.locals.database.close(); }
  });

  it('searches Exa when Decisions rejects catalog candidates, then decides among web matches', async () => {
    const webOffer = { ...best, id: 'web-black-headphones', referenceUrl: 'https://example.com/headphones' };
    const decide = vi.fn().mockResolvedValueOnce({ offers: [], decision: { status: 'no_match' }, warnings: ['No suitable catalog candidate.'] }).mockResolvedValueOnce({ offers: [webOffer], decision: { status: 'selected', offerId: webOffer.id }, warnings: [] });
    const webSearch = vi.fn<ProductProvider['search']>(async () => ({ offers: [webOffer], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify: async () => item, search: async () => ({ offers: [first], warnings: [] }) }, webDemoProvider: { identify: async () => item, search: webSearch }, decisionProvider: decide });
    try {
      const found = await request(app).post('/discover').send({ selection }).expect(200);
      expect(webSearch).toHaveBeenCalledTimes(1);
      expect(decide).toHaveBeenCalledTimes(2);
      expect(found.body).toMatchObject({ discoverySource: 'exa', decision: { status: 'selected', offerId: webOffer.id } });
      expect(found.body.offers[0].title).toBe(webOffer.title);
    } finally { app.locals.database.close(); }
  });

  it('broadens a rejected web search once while keeping the original target and budget', async () => {
    const webOffer = { ...best, id: 'web-recovery-headphones', referenceUrl: 'https://example.com/headphones' };
    const rejected = { offers: [], decision: { status: 'no_match' as const }, warnings: [] };
    const decide = vi.fn().mockResolvedValueOnce(rejected).mockResolvedValueOnce(rejected)
      .mockImplementationOnce(async (_config, input: ProductDecisionInput) => ({ offers: input.offers, decision: { status: 'selected', offerId: input.offers[0].id }, warnings: [] }));
    const webSearch = vi.fn<ProductProvider['search']>(async () => ({ offers: [webOffer], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify: async () => item, search: async () => ({ offers: [first], warnings: [] }) }, webDemoProvider: { identify: async () => item, search: webSearch }, decisionProvider: decide });
    try {
      const found = await request(app).post('/discover').send({ selection, preferences: { budget: 60, currency: 'USD' } }).expect(200);
      expect(webSearch).toHaveBeenCalledTimes(2);
      expect(webSearch.mock.calls[1][0]).toMatchObject({ productType: 'headphones', queries: ['headphones'] });
      expect(decide.mock.calls[2][1]).toMatchObject({ item, selection, preferences: { budget: 60, currency: 'USD' } });
      expect(found.body.offers[0]).toMatchObject({ title: webOffer.title, price: 50, currency: 'USD' });
    } finally { app.locals.database.close(); }
  });

  it('turns rejected web matches into an answerable question instead of a dead end', async () => {
    const webOffer = { ...best, id: 'web-rejected-headphones', referenceUrl: 'https://example.com/headphones' };
    const rejected = { offers: [], decision: { status: 'no_match' as const }, warnings: [] };
    const decide = vi.fn().mockResolvedValue(rejected);
    const identify = vi.fn(async (_selection: Selection) => item);
    const webSearch = vi.fn(async () => ({ offers: [webOffer], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify, search: async () => ({ offers: [first], warnings: [] }) }, webDemoProvider: { identify, search: webSearch }, decisionProvider: decide });
    try {
      const found = await request(app).post('/discover').send({ selection }).expect(200);
      expect(found.body.offers).toEqual([]);
      expect(found.body.interpretation.needsClarification).toBe(true);
      expect(found.body.interpretation.clarification).toContain('headphones');
      expect(webSearch).toHaveBeenCalledTimes(2);
      expect(found.body.webSearch.message).not.toContain('Products were found, but none');
      decide.mockImplementation(async (_config, input: ProductDecisionInput) => ({ offers: input.offers, decision: { status: 'selected', offerId: input.offers[0].id }, warnings: [] }));
      const answered = await request(app).post('/clarify').send({ sessionId: found.body.sessionId, selection, answer: 'Similar headphones are fine' }).expect(200);
      expect(answered.body.offers).toHaveLength(1);
      expect(identify.mock.calls[1][0]).toMatchObject({ ...selection, clarifications: [{ question: found.body.interpretation.clarification, answer: 'Similar headphones are fine' }] });
    } finally { app.locals.database.close(); }
  });

  it('accepts an answer for a legacy empty session while preserving its original crop', async () => {
    const identify = vi.fn(async (_selection: Selection) => item);
    const app = createApp({ config, sampleProvider: { identify, search: async () => ({ offers: [first, best], warnings: [] }) }, decisionProvider: choose });
    const sessionId = '55555555-5555-4555-8555-555555555555';
    try {
      app.locals.database.saveSession({ selection, interpretation: item, preferences: {}, result: { sessionId, mode: 'sample', interpretation: item, offers: [], warnings: [] } });
      const found = await request(app).post('/clarify').send({ sessionId, selection, answer: 'Just similar headphones' }).expect(200);
      expect(found.body.offers[0]).toEqual(best);
      expect(identify.mock.calls[0][0]).toMatchObject({ ...selection, clarifications: [{ answer: 'Just similar headphones' }] });
    } finally { app.locals.database.close(); }
  });

  it('keeps explicit refinement requirements when answering a recovery question', async () => {
    const decide = vi.fn(choose);
    const app = createApp({ config, sampleProvider: { identify: async () => item, search: async () => ({ offers: [first, best], warnings: [] }) }, webDemoProvider: { identify: async () => item, search: async () => ({ offers: [], warnings: [] }) }, decisionProvider: decide });
    try {
      const initial = await request(app).post('/discover').send({ selection }).expect(200);
      decide.mockResolvedValueOnce({ offers: [], decision: { status: 'no_match' }, warnings: [] });
      const refined = await request(app).post('/refine').send({ sessionId: initial.body.sessionId, instruction: 'Must have USB-C' }).expect(200);
      expect(refined.body.interpretation.needsClarification).toBe(true);
      const answered = await request(app).post('/clarify').send({ sessionId: refined.body.sessionId, selection, answer: 'A similar pair is fine' }).expect(200);
      expect(answered.body.offers[0]).toEqual(best);
      expect(decide.mock.lastCall?.[1].instruction).toContain('Must have USB-C');
      expect(decide.mock.lastCall?.[1].instruction).toContain('A similar pair is fine');
    } finally { app.locals.database.close(); }
  });
});
