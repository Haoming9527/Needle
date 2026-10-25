import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebDemoProvider } from '../server/providers/web.js';
import type { ServerConfig } from '../server/config.js';
import type { Interpretation } from '../shared/types.js';

const config: ServerConfig = { exaKey: 'test-exa', openAiKey: 'test-openai', model: 'test-model', defaultMode: 'sample', timeoutMs: 45000, orderFile: null };
const item: Interpretation = { name: 'Black F-style electric mandolin', productType: 'mandolin', brand: null, model: null, color: 'Black', attributes: ['F-style', 'electric'], queries: ['black F-style electric mandolin', '검정 일렉트릭 만돌린'], needsClarification: false, clarification: null };
const source = { title: 'Ortega RMFE40SBK Electric Mandolin | Music Shop', url: 'https://music.example.com/products/ortega-rmfe40sbk?utm_source=search', text: 'Ortega RMFE40SBK Electric Mandolin. F-style black finish. Price EUR 549. Black.', image: 'https://music.example.com/images/mandolin.jpg' };
const product = { sourceIndex: 0, title: 'Ortega RMFE40SBK Electric Mandolin', productEvidence: 'Ortega RMFE40SBK Electric Mandolin. F-style black finish.', description: 'F-style electric mandolin in black.', reason: 'Matches the instrument shape and finish.', differences: ['The model in the selected image is unconfirmed.'], price: 549, currency: 'EUR', priceEvidence: 'EUR 549', illustrativePrice: 599.9, variants: ['Black'] };

type Product = Omit<typeof product, 'price' | 'currency' | 'priceEvidence'> & { price: number | null; currency: string | null; priceEvidence: string | null };
function upstream(products: Product[] = [product], sources = [source]) {
  const mock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    if (String(url).includes('api.exa.ai')) return new Response(JSON.stringify({ results: sources }), { status: 200 });
    return new Response(JSON.stringify({ id: 'response-web', model: config.model, output: [{ type: 'message', id: 'message-web', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ products }), annotations: [] }] }] }), { status: 200 });
  });
  vi.stubGlobal('fetch', mock); return mock;
}
afterEach(() => vi.unstubAllGlobals());

describe('general web product references for the demo catalog', () => {
  it('searches all retailers and keeps the original source and currency', async () => {
    const mock = upstream();
    const result = await new WebDemoProvider(config).search(item, {}, new AbortController().signal);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({ title: product.title, dataOrigin: 'sample', sourceUrl: null, referenceUrl: 'https://music.example.com/products/ortega-rmfe40sbk', price: 549, currency: 'EUR', priceIsIllustrative: false, match: 'similar', shipping: null, availability: null, returns: null });
    const payload = JSON.parse(mock.mock.calls[0][1]?.body as string);
    expect(payload.includeDomains).toBeUndefined();
    expect(payload.query).toContain('mandolin product buy');
    expect(mock.mock.calls.filter(([url]) => !String(url).includes('api.exa.ai'))).toHaveLength(1);
  });

  it('assigns a flagged illustrative USD price only when the source price is unsupported', async () => {
    upstream([{ ...product, price: 99, currency: 'USD', priceEvidence: '$99', illustrativePrice: 599.9 }]);
    const result = await new WebDemoProvider(config).search(item, {}, new AbortController().signal);
    expect(result.offers[0]).toMatchObject({ price: 599.9, currency: 'USD', priceIsIllustrative: true, dataOrigin: 'sample' });
  });

  it('drops invented product identity, invalid source indices and ungrounded variants', async () => {
    upstream([
      { ...product, title: 'Invented guitar', productEvidence: 'Invented guitar' },
      { ...product, sourceIndex: 7 },
      { ...product, variants: ['Black', 'Gold'] },
    ]);
    const result = await new WebDemoProvider(config).search(item, {}, new AbortController().signal);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0].variants).toEqual(['Black']);
    expect(result.offers[0].id).toMatch(/^web-sample-[a-f0-9]{20}$/);
  });

  it('uses the requested currency for illustrative prices and preserves its native precision', async () => {
    upstream([{ ...product, price: null, currency: null, priceEvidence: null, illustrativePrice: 12.345 }]);
    const result = await new WebDemoProvider(config).search(item, { currency: 'KWD' }, new AbortController().signal);
    expect(result.offers[0]).toMatchObject({ price: 12.345, currency: 'KWD', priceIsIllustrative: true });
  });

  it('rejects private, non-HTTPS and credential-bearing reference URLs before model evaluation', async () => {
    const mock = upstream([product], [
      { ...source, url: 'https://127.0.0.1/private' }, { ...source, url: 'http://music.example.com/product' }, { ...source, url: 'https://secret@music.example.com/product' },
    ]);
    const result = await new WebDemoProvider(config).search(item, {}, new AbortController().signal);
    expect(result.offers).toEqual([]);
    expect(mock.mock.calls.every(([url]) => String(url).includes('api.exa.ai'))).toBe(true);
  });

  it('does not convert source currency or invent cheaper replacement prices to satisfy a budget', async () => {
    upstream();
    const result = await new WebDemoProvider(config).search(item, { budget: 1000000, currency: 'KRW' }, new AbortController().signal);
    expect(result.offers).toEqual([]);
  });

  it('does not search while object selection is ambiguous', async () => {
    const mock = upstream();
    const result = await new WebDemoProvider(config).search({ ...item, needsClarification: true, clarification: 'Choose one object.' }, {}, new AbortController().signal);
    expect(result.offers).toEqual([]);
    expect(mock).not.toHaveBeenCalled();
  });
});
