import { afterEach, describe, expect, it, vi } from 'vitest';
import { LiveProvider, exaSearch } from '../server/live-provider.js';
import type { ServerConfig } from '../server/config.js';

const config: ServerConfig = { exaKey: 'test-exa', openAiKey: 'test-openai', model: 'gpt-5.6-terra', defaultMode: 'live', timeoutMs: 45000, orderFile: null };
const identified = {
  name: 'Sony WH-1000XM5 headphones', productType: 'headphones', brand: 'Sony', model: 'WH-1000XM5', color: 'Black', attributes: ['Wireless'],
  queries: ['Sony WH-1000XM5 headphones', '소니 WH-1000XM5 헤드폰'], needsClarification: false, clarification: null as string | null,
};
const source = {
  title: 'Sony WH-1000XM5 headphones | Coupang', url: 'https://www.coupang.com/vp/products/123?itemId=456',
  text: 'Sony WH-1000XM5 headphones. Price KRW 329,000. Black. Free shipping. In stock.',
  image: 'https://images.example.com/sony.jpg',
};
const extracted = {
  sourceIndex: 0, description: 'Wireless headphones', price: 329000, currency: 'KRW', priceEvidence: 'KRW 329,000',
  shipping: 'Free shipping', availability: 'In stock', returns: null as string | null, variants: ['Black'], reason: 'The listing names the requested model.', differences: [], identityEvidence: 'Sony WH-1000XM5 headphones',
};

function upstream({ item = identified, sources = [source], offers = [extracted] } = {}) {
  let modelCalls = 0;
  const mock = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    if (String(url).includes('api.exa.ai')) return new Response(JSON.stringify({ results: sources }), { status: 200 });
    modelCalls++;
    const value = modelCalls === 1 ? item : { offers };
    return new Response(JSON.stringify({ id: `response-${modelCalls}`, model: config.model, output: [{ type: 'message', id: `message-${modelCalls}`, role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }] }), { status: 200 });
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
afterEach(() => vi.unstubAllGlobals());

describe('live workflow with mocked upstream responses', () => {
  it('labels exact only with the buyer’s named identifiers and supporting source evidence', async () => {
    const mock = upstream();
    const provider = new LiveProvider(config);
    const signal = new AbortController().signal;
    const item = await provider.identify({ text: 'Sony WH-1000XM5 headphones' }, signal);
    const results = await provider.search(item, {}, signal);
    expect(results.offers).toHaveLength(1);
    expect(results.offers[0]).toMatchObject({ match: 'exact', price: 329000, currency: 'KRW', dataOrigin: 'retrieved', shipping: 'Free shipping' });
    const searches = mock.mock.calls.filter(([url]) => String(url).includes('api.exa.ai'));
    expect(searches).toHaveLength(2);
    const payload = JSON.parse(searches[0][1]?.body as string);
    expect(payload.includeDomains).toEqual(['coupang.com', 'www.tw.coupang.com']);
    expect(results.warnings.join(' ')).toContain('out of date');
  });

  it('keeps image-inferred model identity below exact-match confidence', async () => {
    upstream();
    const provider = new LiveProvider(config);
    const signal = new AbortController().signal;
    const item = await provider.identify({ imageDataUrl: 'data:image/png;base64,AAAA' }, signal);
    const results = await provider.search(item, {}, signal);
    expect(results.offers[0].match).toBe('likely');
  });

  it('drops hallucinated prices and commercial details, and ignores invented variants', async () => {
    upstream({ offers: [{ ...extracted, price: 1, priceEvidence: 'KRW 1', shipping: 'Arrives tomorrow', availability: 'Only 2 left', returns: 'Free returns for 90 days', variants: ['Black', 'Gold'] }] });
    const provider = new LiveProvider(config);
    const signal = new AbortController().signal;
    const item = await provider.identify({ text: 'Sony WH-1000XM5 headphones' }, signal);
    const results = await provider.search(item, {}, signal);
    expect(results.offers[0]).toMatchObject({ price: null, currency: null, shipping: null, availability: null, returns: null, variants: ['Black'] });
  });

  it('does not claim exact when the model returns an unsupported identity quotation', async () => {
    upstream({ offers: [{ ...extracted, identityEvidence: 'Sony WH-1000XM6' }] });
    const provider = new LiveProvider(config);
    const signal = new AbortController().signal;
    const item = await provider.identify({ text: 'Sony WH-1000XM5 headphones' }, signal);
    const results = await provider.search(item, {}, signal);
    expect(results.offers[0].match).toBe('similar');
  });

  it('does not accept an upstream search result on another domain or a search page', async () => {
    upstream({ sources: [
      { ...source, url: 'https://www.coupang.com.evil.example/vp/products/123' },
      { ...source, url: 'https://www.coupang.com/np/search?q=sony' },
    ] });
    const results = await exaSearch('Sony headphones', config, new AbortController().signal);
    expect(results).toEqual([]);
  });

  it('keeps an unresolved multi-object selection out of product search', async () => {
    const mock = upstream({ item: { ...identified, needsClarification: true, clarification: 'Crop the headphones or describe the item.' } });
    const provider = new LiveProvider(config);
    const signal = new AbortController().signal;
    const item = await provider.identify({ text: 'What is this?', imageDataUrl: 'data:image/png;base64,AAAA' }, signal);
    const result = await provider.search(item, {}, signal);
    expect(result.offers).toEqual([]);
    expect(result.warnings).toContain('Crop the headphones or describe the item.');
    expect(mock.mock.calls.filter(([url]) => String(url).includes('api.exa.ai'))).toHaveLength(0);
  });

  it('does not trust a model to apply cross-currency budget constraints', async () => {
    upstream();
    const provider = new LiveProvider(config);
    const signal = new AbortController().signal;
    const item = await provider.identify({ text: 'Sony WH-1000XM5 headphones' }, signal);
    const result = await provider.search(item, { budget: 500_000, currency: 'USD' }, signal);
    expect(result.offers).toEqual([]);
  });
});
