import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app';
import type { ServerConfig } from '../server/config';
import type { ProductDecisionInput } from '../server/product-decision';
import type { Interpretation, Offer } from '../shared/types';

const config: ServerConfig = { exaKey: 'fixture', openAiKey: 'fixture', model: 'fixture', defaultMode: 'sample', timeoutMs: 45000, orderFile: null, databaseFile: ':memory:' };
const item: Interpretation = { name: 'Black headphones', productType: 'headphones', color: 'black', brand: null, model: null, attributes: [], queries: ['black headphones'], needsClarification: false, clarification: null };
const first: Offer = { id: 'first', title: 'White headphones', description: '', imageUrl: null, sourceUrl: null, match: 'similar', matchEvidence: 'Headphones', price: 10, currency: 'USD', observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'sample', variants: [], shipping: null, availability: null, returns: null, reason: 'A candidate', differences: [] };
const best: Offer = { ...first, id: 'best', title: 'Black headphones', price: 50, reason: 'Matches the selected color and shape.' };
const selection = { imageDataUrl: 'data:image/jpeg;base64,AAAA', annotatedImageDataUrl: 'data:image/jpeg;base64,BBBB', focus: { x: 0.1, y: 0.2 } };
const choose = async (_config: ServerConfig, input: ProductDecisionInput) => ({ offers: [input.offers[1], input.offers[0]], decision: { status: 'selected' as const, offerId: input.offers[1].id, model: 'gpt-6-luna' }, warnings: [] });

describe('Decisions in the shopping workflow', () => {
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
    const webSearch = vi.fn(async () => ({ offers: [webOffer], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify: async () => item, search: async () => ({ offers: [first], warnings: [] }) }, webDemoProvider: { identify: async () => item, search: webSearch }, decisionProvider: decide });
    try {
      const found = await request(app).post('/discover').send({ selection }).expect(200);
      expect(webSearch).toHaveBeenCalledTimes(1);
      expect(decide).toHaveBeenCalledTimes(2);
      expect(found.body).toMatchObject({ discoverySource: 'exa', decision: { status: 'selected', offerId: webOffer.id } });
      expect(found.body.offers[0].title).toBe(webOffer.title);
    } finally { app.locals.database.close(); }
  });
});
