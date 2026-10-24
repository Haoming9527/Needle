import { afterEach, describe, expect, it, vi } from 'vitest';
import { identifyWithAI } from '../server/ai.js';
import type { ServerConfig } from '../server/config.js';
import type { Interpretation } from '../shared/types.js';

const config: ServerConfig = { exaKey: '', openAiKey: 'test-only', model: 'test-model', defaultMode: 'sample', timeoutMs: 45_000, orderFile: null };
const item: Interpretation = {
  name: 'Dark laptop with SpaceX lettering on the lid', productType: 'laptop', brand: null, model: null,
  color: 'Dark brown / charcoal', attributes: ['SpaceX lettering on the lid', 'Rounded display corners'],
  queries: ['dark laptop with SpaceX lettering on lid', 'charcoal laptop SpaceX logo lid'],
  needsClarification: false, clarification: null,
};
const signal = () => new AbortController().signal;
function modelOutput(value: Interpretation) {
  const fetch = vi.fn(async () => Response.json({
    id: 'response-identification', model: config.model,
    output: [{ type: 'message', id: 'message-identification', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(value), annotations: [] }] }],
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
afterEach(() => vi.unstubAllGlobals());

describe('complementary product identification queries', () => {
  it('keeps observed decoration while adding a plain category query for an unidentified product', async () => {
    modelOutput(item);
    const result = await identifyWithAI(config, { imageDataUrl: 'data:image/png;base64,AAAA', focus: { x: .2, y: .7 } }, signal());
    expect(result.queries.slice(0, 2)).toEqual([item.queries[0], 'laptop']);
    expect(result).toMatchObject({ name: item.name, attributes: item.attributes, brand: null, model: null, identifierEvidence: 'visual' });
  });

  it('retains a text-verified brand and model in both queries', async () => {
    const identified = { ...item, name: 'Lenovo ThinkPad X1 Carbon laptop', brand: 'Lenovo', model: 'ThinkPad X1 Carbon', queries: ['Lenovo ThinkPad X1 Carbon laptop', 'Lenovo ThinkPad X1 Carbon buy'] };
    modelOutput(identified);
    const result = await identifyWithAI(config, { text: 'Lenovo ThinkPad X1 Carbon laptop only' }, signal());
    expect(result.identifierEvidence).toBe('text');
    expect(result.queries).toEqual(identified.queries);
    expect(result.name).toBe(identified.name);
  });

  it.each([
    { brand: 'Lenovo', productType: 'laptop' },
    { brand: 'Sony', productType: 'headphones' },
  ])('keeps a visually supported $brand brand in retrieval when the exact model is unknown', async ({ brand, productType }) => {
    const branded = {
      ...item, name: `${brand} ${productType} with decorative stickers`, brand, productType,
      attributes: ['Built-in manufacturer emblem', 'Decorative sticker'],
      queries: [`${brand} ${productType} with decorative stickers`, `${productType} with stickers`],
    };
    modelOutput(branded);
    const result = await identifyWithAI(config, { imageDataUrl: 'data:image/png;base64,AAAA', focus: { x: .2, y: .7 } }, signal());
    expect(result.queries.slice(0, 2)).toEqual([branded.queries[0], `${brand} ${productType}`]);
    expect(result.queries).not.toContain(productType);
    expect(result).toMatchObject({ brand, model: null, identifierEvidence: 'visual' });
  });

  it('does not broaden an ambiguous target before the buyer answers', async () => {
    const uncertain = { ...item, needsClarification: true, clarification: 'The laptop or its sticker?' };
    modelOutput(uncertain);
    const result = await identifyWithAI(config, { imageDataUrl: 'data:image/png;base64,AAAA' }, signal());
    expect(result.queries).toEqual(uncertain.queries);
    expect(result.clarification).toBe(uncertain.clarification);
  });

  it('avoids duplicate category queries when the precise query is already broad', async () => {
    modelOutput({ ...item, productType: '  laptop  ', queries: ['Laptop', 'laptop'] });
    const result = await identifyWithAI(config, { text: 'laptop' }, signal());
    expect(result.queries).toEqual(['Laptop']);
  });
});
