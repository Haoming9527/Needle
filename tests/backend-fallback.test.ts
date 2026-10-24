import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import type { ServerConfig } from '../server/config.js';
import { ApiError } from '../server/errors.js';
import type { Interpretation, Offer } from '../shared/types.js';
import type { ProductProvider, ProviderResult } from '../server/provider.js';

const config: ServerConfig = { exaKey: 'test-exa', openAiKey: 'test-openai', model: 'test-model', defaultMode: 'sample', timeoutMs: 45000, orderFile: null };
const item: Interpretation = { name: 'Black F-style electric mandolin', productType: 'mandolin', brand: null, model: null, color: 'Black', attributes: ['F-style', 'electric'], queries: ['black F-style electric mandolin', '검정 일렉트릭 만돌린'], needsClarification: false, clarification: null };
const offer: Offer = { id: 'web-sample-mandolin', title: 'Electric mandolin', description: 'An electric mandolin listing.', imageUrl: null, sourceUrl: null, referenceUrl: 'https://music.example.com/mandolin', match: 'similar', matchEvidence: 'The listing names a mandolin.', price: null, currency: null, observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'sample', variants: [], shipping: null, availability: null, returns: null, reason: 'Matches the requested instrument type.', differences: ['Model is unconfirmed.'] };
const empty: ProviderResult = { offers: [], warnings: ['No sample items match this target.'] };
const body = { selection: { imageDataUrl: 'data:image/png;base64,AAAA', pageUrl: 'https://x.com/example/status/123' }, mode: 'sample' };
const apps: ReturnType<typeof createApp>[] = [];

function setup(overrides: Partial<ServerConfig> = {}, interpreted = item, primary: ProviderResult = empty) {
  const sample: ProductProvider = { identify: vi.fn(async () => interpreted), search: vi.fn(async () => primary) };
  const live: ProductProvider = { identify: vi.fn(async () => interpreted), search: vi.fn(async () => ({ offers: [offer], warnings: ['Retrieved information may be out of date.'] })) };
  const web: ProductProvider = { identify: vi.fn(async () => interpreted), search: vi.fn(async () => ({ offers: [offer], warnings: [] })) };
  const app = createApp({ config: { ...config, ...overrides }, sampleProvider: sample, liveProvider: live, webDemoProvider: web, decisionProvider: async (_config, input) => ({ offers: input.offers, decision: { status: 'unavailable' }, warnings: [] }) });
  apps.push(app);
  return { app, sample, live, web };
}

afterEach(() => { for (const app of apps.splice(0)) app.locals.database.close(); });

describe('automatic Exa fallback for catalog misses', () => {
  it('searches across stores directly with the existing interpretation and retains provenance', async () => {
    const { app, sample, live, web } = setup();
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(sample.identify).toHaveBeenCalledTimes(1);
    expect(web.identify).not.toHaveBeenCalled();
    expect(live.search).not.toHaveBeenCalled();
    expect(web.search).toHaveBeenCalledWith(item, {}, expect.any(AbortSignal), '');
    expect(response.body).toMatchObject({ mode: 'sample', discoverySource: 'exa', webSearch: { status: 'used' }, interpretation: item });
    expect(response.body.offers).toEqual([offer]);
    expect(app.locals.database.session(response.body.sessionId).selection).toEqual({ pageUrl: body.selection.pageUrl });
    const cart = await request(app).post('/cart').send({ sessionId: response.body.sessionId, offerId: offer.id }).expect(200);
    expect(cart.body.items[0].offer).toMatchObject({ dataOrigin: 'sample', sourceUrl: null, referenceUrl: offer.referenceUrl, price: null, currency: null });
  });

  it('keeps catalog results first and does not call Exa when a match exists', async () => {
    const catalogOffer: Offer = { ...offer, id: 'sample-mandolin', dataOrigin: 'sample', sourceUrl: null };
    const { app, live, web } = setup({}, item, { offers: [catalogOffer], warnings: [] });
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(response.body.discoverySource).toBe('catalog');
    expect(response.body.webSearch).toBeUndefined();
    expect(web.search).not.toHaveBeenCalled();
  });

  it('does not search unresolved objects', async () => {
    const { app, live, web } = setup({}, { ...item, needsClarification: true, clarification: 'Choose the instrument in the image.' });
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(response.body.interpretation.needsClarification).toBe(true);
    expect(response.body.webSearch).toBeUndefined();
    expect(web.search).not.toHaveBeenCalled();
  });

  it.each([
    [{ exaKey: '' }, 'EXA_API_KEY'],
    [{ openAiKey: '' }, 'OPENAI_API_KEY'],
  ])('explains missing configuration without fabricating offers', async (overrides, missingKey) => {
    const { app, live, web } = setup(overrides);
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(response.body.offers).toEqual([]);
    expect(response.body.webSearch).toMatchObject({ status: 'unavailable' });
    expect(response.body.webSearch.message).toContain(missingKey);
    expect(response.body.webSearch.message).toContain('.env');
    expect(response.body.warnings).toContain(empty.warnings[0]);
    expect(web.search).not.toHaveBeenCalled();
  });

  it('preserves the target and exposes a useful retry message when Exa fails', async () => {
    const { app, live, web } = setup();
    vi.mocked(web.search).mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'Exa is busy. Please retry later.'));
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(response.body.interpretation).toEqual(item);
    expect(response.body.offers).toEqual([]);
    expect(response.body.webSearch.status).toBe('failed');
    expect(response.body.webSearch.message).toContain('Please retry later');
    expect(app.locals.database.session(response.body.sessionId).selection).toEqual({ pageUrl: body.selection.pageUrl });
  });

  it('never leaks unexpected upstream error details', async () => {
    const { app, live, web } = setup();
    vi.mocked(web.search).mockRejectedValue(new Error('sensitive upstream context'));
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(response.body.webSearch.status).toBe('failed');
    expect(JSON.stringify(response.body)).not.toContain('sensitive upstream context');
  });

  it('reports an empty web search with recovery guidance', async () => {
    const { app, live, web } = setup();
    vi.mocked(web.search).mockResolvedValue({ offers: [], warnings: ['No product pages were retrieved.'] });
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(response.body).toMatchObject({ discoverySource: 'exa', webSearch: { status: 'empty' }, offers: [] });
    expect(response.body.webSearch.message).toContain('broader description');
    expect(web.search).toHaveBeenCalledWith(item, {}, expect.any(AbortSignal), '');
  });

  it('asks about the current budget after no matching offers and accepts a higher budget', async () => {
    const { app, web } = setup();
    vi.mocked(web.search).mockImplementation(async (_item, preferences) => ({ offers: preferences.budget! >= 200 ? [{ ...offer, price: 199, currency: 'USD' }] : [], warnings: [] }));
    const initial = await request(app).post('/discover').send({ ...body, preferences: { budget: 50, currency: 'USD' } }).expect(200);
    expect(initial.body.interpretation.needsClarification).toBe(true);
    expect(initial.body.interpretation.clarification).toContain('USD 50');
    expect(initial.body.interpretation.clarification).toMatch(/budget/i);
    const answered = await request(app).post('/clarify').send({ sessionId: initial.body.sessionId, selection: body.selection, answer: 'Raise my budget to USD 200' }).expect(200);
    expect(answered.body.offers[0]).toMatchObject({ price: 199, currency: 'USD' });
  });

  it('turns grounded web matches into persistent demo items', async () => {
    const { app, live, web } = setup();
    vi.mocked(web.search).mockResolvedValue({ offers: [], warnings: [] });
    const webOffer: Offer = { ...offer, id: 'web-sample-mandolin', dataOrigin: 'sample', sourceUrl: null, referenceUrl: 'https://music.example.com/mandolin', price: 599900, currency: 'KRW', priceIsIllustrative: true };
    vi.mocked(web.search).mockResolvedValue({ offers: [webOffer], warnings: ['Prices marked illustrative are generated examples.'] });
    const response = await request(app).post('/discover').send(body).expect(200);
    expect(response.body).toMatchObject({ mode: 'sample', discoverySource: 'exa', webSearch: { status: 'used' } });
    expect(response.body.offers[0]).toMatchObject(webOffer);
    expect(app.locals.database.catalog().find((product: { id: string }) => product.id === webOffer.id)).toMatchObject({ referenceUrl: webOffer.referenceUrl, price: 599900, priceIsIllustrative: true });
    expect(web.identify).not.toHaveBeenCalled();
  });

  it('retains the original object and catalog-first mode when refining an Exa fallback', async () => {
    const { app, sample, live, web } = setup();
    const initial = await request(app).post('/discover').send(body).expect(200);
    const instruction = 'Find something similar under KRW 500,000';
    const response = await request(app).post('/refine').send({ sessionId: initial.body.sessionId, instruction }).expect(200);
    expect(sample.identify).toHaveBeenCalledTimes(1);
    expect(web.identify).not.toHaveBeenCalled();
    expect(sample.search).toHaveBeenCalledTimes(2);
    expect(web.search).toHaveBeenLastCalledWith(item, { budget: 500000, currency: 'KRW' }, expect.any(AbortSignal), instruction);
    expect(response.body).toMatchObject({ mode: 'sample', discoverySource: 'exa', interpretation: { ...item, needsClarification: true, clarification: expect.stringContaining('mandolin') } });
    expect(app.locals.database.session(response.body.sessionId).interpretation).toEqual(response.body.interpretation);
    expect(response.body.sessionId).not.toBe(initial.body.sessionId);
    expect(app.locals.database.session(response.body.sessionId).selection).toEqual({ pageUrl: body.selection.pageUrl });
  });

  it('shares the original request deadline with fallback instead of starting a new timeout', async () => {
    const { app, live, web } = setup({ timeoutMs: 25 });
    let signal: AbortSignal | undefined;
    vi.mocked(web.search).mockImplementation(async (_item, _preferences, incoming) => {
      signal = incoming;
      return new Promise<ProviderResult>(() => {});
    });
    const response = await request(app).post('/discover').send(body).expect(504);
    expect(response.body.error.code).toBe('TIMEOUT');
    expect(signal?.aborted).toBe(true);
  });
});
