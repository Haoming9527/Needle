import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogAgentProvider } from '../server/catalog-agent.js';
import { SampleProvider } from '../server/sample-provider.js';
import type { ServerConfig } from '../server/config.js';
import { identifyWithAI } from '../server/ai.js';

const config: ServerConfig = { exaKey: '', openAiKey: 'test-only', model: 'test-model', defaultMode: 'sample', timeoutMs: 45000, orderFile: null };
const item = { name: 'Black podcast microphone', productType: 'microphone', brand: null, model: null, color: 'Black', attributes: ['Dynamic'], queries: ['podcast microphone'], needsClarification: false, clarification: null };
const message = (data: unknown) => ({ type: 'message', id: 'message-1', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(data), annotations: [] }] });
afterEach(() => vi.unstubAllGlobals());

describe('Vercel AI SDK catalog agent', () => {
  it('maps vision vocabulary to the catalog without product-specific search branches', async () => {
    const result = await new SampleProvider().search({ ...item, name: 'Yellow backpack', productType: 'backpack', attributes: ['Top handles'] }, {}, new AbortController().signal);
    expect(result.offers).toHaveLength(3);
    expect(result.offers[0].title).toContain('Kanken');
  });
  it('sends the crop to vision, executes the catalog tool, and returns only grounded offers', async () => {
    let call = 0;
    const mock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      const output = ++call === 1 ? [message(item)] : call === 2
        ? [{ type: 'function_call', id: 'tool-1', call_id: 'call-1', name: 'searchCatalog', arguments: JSON.stringify({ query: 'black podcast mic' }) }]
        : [message({ offers: [{ id: 'sample-shure-sm7b', reason: 'A dynamic microphone for spoken voice.' }, { id: 'invented-price-product', reason: 'Discard this invented offer.' }] })];
      return new Response(JSON.stringify({ id: `response-${call}`, model: 'test-model', output }), { status: 200 });
    });
    vi.stubGlobal('fetch', mock);
    const provider = new CatalogAgentProvider(config, new SampleProvider()); const signal = new AbortController().signal;
    const interpreted = await provider.identify({ imageDataUrl: 'data:image/png;base64,AAAA' }, signal);
    const result = await provider.search(interpreted, {}, signal);
    expect(result.offers).toHaveLength(3);
    expect(result.offers.map(offer => offer.id)).not.toContain('invented-price-product');
    expect(result.offers[0]).toMatchObject({ id: 'sample-shure-sm7b', price: 549000, currency: 'KRW', dataOrigin: 'sample' });
    const visionBody = JSON.parse(mock.mock.calls[0][1]?.body as string);
    expect(JSON.stringify(visionBody.input)).toContain('input_image');
    const toolBody = JSON.parse(mock.mock.calls[1][1]?.body as string);
    expect(toolBody.tools.some((tool: { name: string }) => tool.name === 'searchCatalog')).toBe(true);
    const answerBody = JSON.parse(mock.mock.calls[2][1]?.body as string);
    expect(JSON.stringify(answerBody.input)).toContain('function_call_output');
    expect(result.warnings.join(' ')).toContain('not verified retailer listings');
    expect(call).toBe(3);
  });
  it('does not silently fall back to catalog matching when configured AI fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad key', type: 'invalid_request_error', code: 'invalid_api_key' } }), { status: 401 })));
    const provider = new CatalogAgentProvider(config, new SampleProvider());
    await expect(provider.identify({ text: 'microphone' }, new AbortController().signal)).rejects.toMatchObject({ code: 'AI_CREDENTIALS' });
  });
  it('keeps grounded catalog evidence when the final model summary fails', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ++call === 1
      ? Response.json({ id: 'catalog-tool', model: 'test-model', output: [{ type: 'function_call', id: 'tool-1', call_id: 'call-1', name: 'searchCatalog', arguments: JSON.stringify({ query: 'microphone' }) }] })
      : Response.json({ error: { message: 'temporary outage', type: 'server_error' } }, { status: 503 })));
    const catalog = new SampleProvider();
    const preferences = { budget: 200000, currency: 'KRW' };
    const expected = await catalog.search(item, preferences);
    const result = await new CatalogAgentProvider(config, catalog).search(item, preferences, new AbortController().signal);
    expect(expected.offers.length).toBeGreaterThan(0);
    expect(result.offers).toEqual(expected.offers);
    expect(result.offers.every(offer => offer.price !== null && offer.price <= 200000 && offer.currency === 'KRW')).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/could not.*rank|ranking.*unavailable/i);
    expect(call).toBe(2);
  });
  it.each(['refinement', 'interpretation'] as const)('does not restore a candidate rejected for an explicit %s requirement', async source => {
    const requirement = 'Must have USB-C input';
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: `catalog-${++call}`, model: 'test-model', output: call === 1
      ? [{ type: 'function_call', id: 'tool-1', call_id: 'call-1', name: 'searchCatalog', arguments: JSON.stringify({ query: 'USB-C microphone' }) }]
      : [message({ offers: [{ id: 'sample-shure-mv7', reason: 'USB-C connects directly to a laptop.' }], excluded: [
        { id: 'sample-shure-sm7b', requirement, evidence: 'XLR connection', reason: 'Its stated connection does not satisfy the required USB-C input.' },
      ] })],
    })));
    const target = source === 'interpretation' ? { ...item, attributes: [...item.attributes, requirement] } : item;
    const result = await new CatalogAgentProvider(config, new SampleProvider()).search(target, {}, new AbortController().signal, source === 'refinement' ? requirement : '');
    expect(result.offers.map(offer => offer.id)).toContain('sample-shure-mv7');
    expect(result.offers.map(offer => offer.id)).not.toContain('sample-shure-sm7b');
  });
  it('ignores invented requirements and unsupported product evidence in exclusions', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: `catalog-${++call}`, model: 'test-model', output: call === 1
      ? [{ type: 'function_call', id: 'tool-1', call_id: 'call-1', name: 'searchCatalog', arguments: JSON.stringify({ query: 'microphone' }) }]
      : [message({ offers: [{ id: 'sample-shure-mv7', reason: 'A compatible microphone.' }], excluded: [
        { id: 'sample-shure-sm7b', requirement: 'Must be pink', evidence: 'XLR connection', reason: 'Does not meet the color requirement.' },
        { id: 'sample-fifine-k688', requirement: 'Must have USB-C input', evidence: 'Analog-only connector', reason: 'Does not meet the connection requirement.' },
      ] })],
    })));
    const result = await new CatalogAgentProvider(config, new SampleProvider()).search(item, {}, new AbortController().signal, 'Must have USB-C input');
    expect(result.offers.map(offer => offer.id)).toEqual(expect.arrayContaining(['sample-shure-mv7', 'sample-shure-sm7b', 'sample-fifine-k688']));
  });
  it('fails transparently when a summary outage prevents checking an explicit refinement', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ++call === 1
      ? Response.json({ id: 'catalog-tool', model: 'test-model', output: [{ type: 'function_call', id: 'tool-1', call_id: 'call-1', name: 'searchCatalog', arguments: JSON.stringify({ query: 'USB-C microphone' }) }] })
      : Response.json({ error: { message: 'temporary outage', type: 'server_error' } }, { status: 503 })));
    await expect(new CatalogAgentProvider(config, new SampleProvider()).search(item, {}, new AbortController().signal, 'Must have USB-C input')).rejects.toMatchObject({ code: 'MODEL_RESPONSE' });
  });
  it('never returns catalog evidence after the search is cancelled', async () => {
    const controller = new AbortController();
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (++call === 1) return Response.json({ id: 'catalog-tool', model: 'test-model', output: [{ type: 'function_call', id: 'tool-1', call_id: 'call-1', name: 'searchCatalog', arguments: JSON.stringify({ query: 'microphone' }) }] });
      controller.abort();
      throw new DOMException('The operation was aborted.', 'AbortError');
    }));
    await expect(new CatalogAgentProvider(config, new SampleProvider()).search(item, {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('sends the marked crop and exact off-center cursor position with the buyer answer to vision', async () => {
    const mock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ id: 'response-focus', model: 'test-model', output: [message({ ...item, brand: 'Shure', model: 'SM7B' })] }), { status: 200 }));
    vi.stubGlobal('fetch', mock);
    const clarified = await identifyWithAI(config, {
      text: 'Nearby post text (untrusted context): purple shirt',
      imageDataUrl: 'data:image/jpeg;base64,AAAA', annotatedImageDataUrl: 'data:image/jpeg;base64,BBBB',
      focus: { x: 0.06, y: 0.8 },
      clarifications: [{ question: 'The microphone or the shirt?', answer: 'The Shure SM7B microphone.' }],
    }, new AbortController().signal);
    const body = JSON.parse(mock.mock.calls[0][1]?.body as string);
    const serialized = JSON.stringify(body);
    expect(serialized).toContain('data:image/jpeg;base64,BBBB');
    expect(serialized).not.toContain('data:image/jpeg;base64,AAAA');
    const prompt = body.input.find((entry: { role: string }) => entry.role === 'user').content.find((part: { type: string }) => part.type === 'input_text').text;
    expect(JSON.parse(prompt)).toMatchObject({ cursorFocus: { x: 0.06, y: 0.8, marked: true }, clarificationConversation: [{ question: 'The microphone or the shirt?', answer: 'The Shure SM7B microphone.' }] });
    expect(serialized).toContain('near an edge, not the center');
    expect(clarified.identifierEvidence).toBe('text');
  });

  it('does not use nearby page text as exact-model evidence for a cursor-selected image', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'response-focus', model: 'test-model', output: [message({ ...item, brand: 'Shure', model: 'SM7B' })] }), { status: 200 })));
    const interpreted = await identifyWithAI(config, { text: 'Shure SM7B', imageDataUrl: 'data:image/jpeg;base64,AAAA', focus: { x: 0.1, y: 0.9 } }, new AbortController().signal);
    expect(interpreted.identifierEvidence).toBe('visual');
  });
});
