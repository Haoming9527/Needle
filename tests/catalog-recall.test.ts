import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import { sampleCatalog, type SampleProduct } from '../server/storage/catalog.js';
import type { ServerConfig } from '../server/config.js';
import type { ProductDecisionInput } from '../server/agent/product-decision.js';
import { SampleProvider } from '../server/providers/catalog.js';
import type { Interpretation, Offer } from '../shared/types.js';

const config: ServerConfig = { exaKey: 'test-only', openAiKey: 'test-only', model: 'test-model', defaultMode: 'sample', timeoutMs: 45000, orderFile: null, databaseFile: ':memory:' };
const item: Interpretation = {
  name: 'Dark gray laptop with SpaceX lettering and stickers', productType: 'laptop', brand: null, model: null, color: 'Dark gray',
  attributes: ['SpaceX lettering on the back of the display', 'Circular decorative sticker on the lid', 'Thin display with rounded corners'],
  queries: ['dark gray laptop thin display rounded corners', 'laptop', 'gray laptop'], needsClarification: false, clarification: null, identifierEvidence: 'visual',
};
const spaceLaptop: Offer = {
  id: 'cached-space-edition', title: 'ASUS ZenBook 14X OLED Space Edition Laptop',
  description: 'A 14-inch OLED laptop with space-themed lid graphics and a lid-mounted ZenVision display.',
  imageUrl: null, sourceUrl: null, referenceUrl: 'https://example.com/space-laptop', match: 'similar', matchEvidence: 'Same product category only.',
  price: 2200, currency: 'USD', observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'sample', variants: [],
  shipping: null, availability: null, returns: null, reason: 'Laptop alternative.', differences: ['Manufacturer is not verified.'],
};
const message = (data: unknown) => ({ type: 'message', id: 'message-1', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(data), annotations: [] }] });
afterEach(() => vi.unstubAllGlobals());

describe('catalog candidate recall before the visual decision', () => {
  it('keeps the saved MacBook available to Decisions when the catalog summary favors a space-themed laptop', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: `response-${++call}`, model: 'test-model', output: call === 1 ? [message(item)] : call === 2
      ? [{ type: 'function_call', id: 'tool-1', call_id: 'call-1', name: 'searchCatalog', arguments: JSON.stringify({ query: 'dark gray laptop' }) }]
      : [message({ offers: [{ id: spaceLaptop.id, reason: 'Space-themed lid.' }], excluded: [] })] })));
    const webSearch = vi.fn(async () => ({ offers: [spaceLaptop], warnings: [] }));
    const decide = vi.fn(async (_config: ServerConfig, input: ProductDecisionInput) => {
      const macbook = input.offers.find(offer => offer.id === 'sample-macbook-air');
      const chosen = macbook ?? input.offers[0];
      return { offers: [chosen, ...input.offers.filter(offer => offer.id !== chosen.id)], decision: { status: 'selected' as const, offerId: chosen.id }, warnings: [] };
    });
    const app = createApp({ config, decisionProvider: decide, webDemoProvider: { identify: async () => item, search: webSearch } });
    try {
      app.locals.database.cacheWebOffers(item, [spaceLaptop]);
      const found = await request(app).post('/discover').send({ selection: { imageDataUrl: 'data:image/png;base64,AAAA', focus: { x: .4, y: .8 } } }).expect(200);
      expect(decide.mock.calls[0][1].offers.map(offer => offer.id)).toContain('sample-macbook-air');
      expect(decide.mock.calls[0][1].offers.length).toBeGreaterThan(3);
      expect(found.body.offers).toHaveLength(3);
      expect(found.body.offers[0]).toMatchObject({ id: 'sample-macbook-air', title: 'Apple MacBook Air 13-inch M4', match: 'similar', price: 1490000, currency: 'KRW' });
      expect(found.body.discoverySource).toBe('catalog');
      expect(webSearch).not.toHaveBeenCalled();
    } finally { app.locals.database.close(); }
  });

  it('uses structured brand evidence even when the description only says laptop', async () => {
    const competitors = Array.from({ length: 5 }, (_, index): SampleProduct => ({ ...sampleCatalog.find(product => product.id === 'sample-asus-vivobook')!, id: `competitor-${index}`, title: `Laptop ${index}`, attributes: ['Thin display with rounded corners'] }));
    const provider = new SampleProvider(() => [...competitors, sampleCatalog.find(product => product.id === 'sample-macbook-air')!]);
    const result = await provider.search({ ...item, name: 'Laptop', brand: 'Apple', attributes: [] }, {});
    expect(result.offers[0].id).toBe('sample-macbook-air');
    expect(result.offers[0].match).toBe('similar');
  });

  it('retains prepared products in a crowded cache without bypassing category or currency budgets', async () => {
    const template = sampleCatalog.find(product => product.id === 'sample-asus-vivobook')!;
    const cached = Array.from({ length: 12 }, (_, index): SampleProduct => ({ ...template, id: `cached-${index}`, referenceUrl: `https://example.com/laptop-${index}`, title: `Dark gray laptop with thin display ${index}`, attributes: item.attributes }));
    const provider = new SampleProvider(() => [...cached, ...sampleCatalog]);
    const result = await provider.searchCandidates(item, { budget: 1500000, currency: 'KRW' });
    expect(result.offers).toHaveLength(8);
    expect(result.offers.map(offer => offer.id)).toContain('sample-macbook-air');
    const valid = new Set([...cached, ...sampleCatalog].filter(product => product.productType === 'laptop' && product.currency === 'KRW' && product.price !== null && product.price <= 1500000).map(product => product.id));
    expect(result.offers.every(offer => valid.has(offer.id))).toBe(true);
    const cheaper = await provider.searchCandidates(item, { budget: 700000, currency: 'KRW' });
    expect(cheaper.offers.map(offer => offer.id)).not.toContain('sample-macbook-air');
    expect(cheaper.offers.every(offer => offer.price! <= 700000 && offer.currency === 'KRW')).toBe(true);
  });
});
