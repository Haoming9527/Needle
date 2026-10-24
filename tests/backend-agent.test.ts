import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogAgentProvider } from '../server/catalog-agent.js';
import { SampleProvider } from '../server/sample-provider.js';
import type { ServerConfig } from '../server/config.js';

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
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({ id: 'sample-shure-sm7b', price: 549000, currency: 'KRW', dataOrigin: 'sample' });
    const visionBody = JSON.parse(mock.mock.calls[0][1]?.body as string);
    expect(JSON.stringify(visionBody.input)).toContain('input_image');
    const toolBody = JSON.parse(mock.mock.calls[1][1]?.body as string);
    expect(toolBody.tools.some((tool: { name: string }) => tool.name === 'searchCatalog')).toBe(true);
    const answerBody = JSON.parse(mock.mock.calls[2][1]?.body as string);
    expect(JSON.stringify(answerBody.input)).toContain('function_call_output');
    expect(result.warnings.join(' ')).toContain('not verified Coupang listings');
    expect(call).toBe(3);
  });
  it('does not silently fall back to catalog matching when configured AI fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad key', type: 'invalid_request_error', code: 'invalid_api_key' } }), { status: 401 })));
    const provider = new CatalogAgentProvider(config, new SampleProvider());
    await expect(provider.identify({ text: 'microphone' }, new AbortController().signal)).rejects.toMatchObject({ code: 'AI_CREDENTIALS' });
  });
});
