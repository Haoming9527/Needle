import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideProducts } from '../server/product-decision.js';
import type { ServerConfig } from '../server/config.js';
import type { Interpretation, Offer } from '../shared/types.js';

const config: ServerConfig = { openAiKey: 'test-only', exaKey: '', model: 'unused-responses-model', defaultMode: 'sample', timeoutMs: 45000, orderFile: null };
const item: Interpretation = { name: 'Black F-style mandolin', productType: 'mandolin', brand: null, model: null, color: 'Black', attributes: ['F-style body'], queries: ['black F-style mandolin'], needsClarification: false, clarification: null };
const offer = (id: string, title: string, price = 100, currency = 'USD'): Offer => ({ id, title, description: title, imageUrl: null, sourceUrl: 'https://example.com/products/' + id, match: 'similar', matchEvidence: 'Shape and color only', price, currency, observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'retrieved', variants: ['Black'], shipping: null, availability: null, returns: null, reason: 'Matches the requested style.', differences: [] });
const offers = [offer('guitar', 'Black electric guitar', 49), offer('mandolin', 'Black F-style mandolin', 549.99), offer('brown-mandolin', 'Brown A-style mandolin', 99)];
const noMatch = '__no_suitable_product__';
function answer(choice = 'mandolin', probabilities: Record<string, number> = { guitar: .01, mandolin: .8, 'brown-mandolin': .15, [noMatch]: .04 }) {
  return { model: 'gpt-6-luna', answers: [{ type: 'choice', name: 'mostSuitableProduct', choice, probabilities: Object.entries(probabilities).map(([value, probability]) => ({ value, probability })) }] };
}
function mockDecision(body: unknown = answer()) {
  const mock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json(body));
  vi.stubGlobal('fetch', mock); return mock;
}
const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());

describe('OpenAI Decisions product selection', () => {
  it('uses the Decisions endpoint to select a non-first product and preserves every product fact', async () => {
    const mock = mockDecision();
    const before = structuredClone(offers);
    const result = await decideProducts(config, { item, offers, preferences: {} }, signal());
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock.mock.calls[0][0]).toBe('https://api.openai.com/v1/decisions');
    const body = JSON.parse(mock.mock.calls[0][1]!.body as string);
    expect(body.model).toBe('gpt-6-luna');
    expect(body.questions[0].choices.map((entry: { value: string }) => entry.value)).toEqual(['guitar', 'mandolin', 'brown-mandolin', noMatch]);
    expect(result.decision).toEqual({ status: 'selected', offerId: 'mandolin', model: 'gpt-6-luna' });
    expect(result.offers.map(value => value.id)).toEqual(['mandolin', 'brown-mandolin', 'guitar']);
    expect(result.offers[0]).toEqual(offers[1]);
    expect(offers).toEqual(before);
    expect(result.offers[0]).toMatchObject({ price: 549.99, currency: 'USD', match: 'similar' });
  });

  it('sends the marked target crop, exact cursor point and buyer constraints without fetching remote pictures', async () => {
    const mock = mockDecision();
    await decideProducts(config, { item, offers, preferences: {}, instruction: 'Most similar shape, not the cheapest', selection: { imageDataUrl: 'data:image/jpeg;base64,AAAA', annotatedImageDataUrl: 'data:image/jpeg;base64,BBBB', imageUrl: 'https://untrusted.example/secret.png', focus: { x: .08, y: .9 }, clarifications: [{ question: 'The instrument or shirt?', answer: 'The instrument on the wall.' }] } }, signal());
    const body = JSON.parse(mock.mock.calls[0][1]!.body as string);
    expect(body.input[0].content.find((part: { type: string }) => part.type === 'input_image').image_url).toBe('data:image/jpeg;base64,BBBB');
    const evidence = JSON.parse(body.input[0].content[0].text);
    expect(evidence.cursorFocus).toMatchObject({ x: .08, y: .9 });
    expect(evidence.buyerRefinement).toContain('not the cheapest');
    expect(evidence.clarificationConversation[0].answer).toContain('instrument');
    expect(JSON.stringify(body)).not.toContain('untrusted.example');
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('can reject all candidates without fabricating a winner', async () => {
    mockDecision(answer(noMatch, { guitar: .02, mandolin: .02, 'brown-mandolin': .02, [noMatch]: .94 }));
    const result = await decideProducts(config, { item, offers, preferences: {} }, signal());
    expect(result.offers).toEqual([]);
    expect(result.decision.status).toBe('no_match');
    expect(result.warnings.join(' ')).toContain('no suitable product');
  });

  it('applies an exact-currency budget before constructing choices', async () => {
    const mock = mockDecision(answer('within-budget', { 'within-budget': .95, [noMatch]: .05 }));
    const candidates = [offer('too-expensive', 'Mandolin', 150, 'USD'), offer('foreign', 'Mandolin', 50, 'KRW'), { ...offer('unknown', 'Mandolin'), price: null }, offer('within-budget', 'Mandolin', 90, 'USD')];
    const result = await decideProducts(config, { item, offers: candidates, preferences: { budget: 100, currency: 'USD' } }, signal());
    expect(result.offers.map(value => value.id)).toEqual(['within-budget']);
    const body = JSON.parse(mock.mock.calls[0][1]!.body as string);
    expect(body.questions[0].choices.map((entry: { value: string }) => entry.value)).toEqual(['within-budget', noMatch]);
  });

  it.each([
    answer('invented', { invented: .8, guitar: .05, mandolin: .05, 'brown-mandolin': .05, [noMatch]: .05 }),
    answer('mandolin', { guitar: .6, mandolin: .1, 'brown-mandolin': .2, [noMatch]: .1 }),
    { model: 'gpt-6-luna', answers: [] },
  ])('does not label invalid decision output as a selected product', async body => {
    mockDecision(body);
    const result = await decideProducts(config, { item, offers, preferences: {} }, signal());
    expect(result.decision.status).toBe('failed');
    expect(result.decision.offerId).toBeUndefined();
    expect(result.offers).toEqual(offers);
    expect(result.warnings.join(' ')).toContain('retain their search order');
  });

  it('keeps missing-key and upstream failures honest without leaking provider context', async () => {
    const mock = mockDecision();
    const unavailable = await decideProducts({ ...config, openAiKey: '' }, { item, offers, preferences: {} }, signal());
    expect(unavailable.decision.status).toBe('unavailable');
    expect(mock).not.toHaveBeenCalled();
    mock.mockRejectedValue(new Error('secret-key and private selected image'));
    const failed = await decideProducts(config, { item, offers, preferences: {} }, signal());
    expect(failed.decision.status).toBe('failed');
    expect(JSON.stringify(failed)).not.toContain('secret-key');
  });

  it('skips empty and ambiguous searches', async () => {
    const mock = mockDecision();
    expect((await decideProducts(config, { item, offers: [], preferences: {} }, signal())).offers).toEqual([]);
    expect((await decideProducts(config, { item: { ...item, needsClarification: true }, offers, preferences: {} }, signal())).offers).toEqual([]);
    expect(mock).not.toHaveBeenCalled();
  });

  it('propagates cancellation instead of returning a fallback result', async () => {
    const controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async () => { controller.abort(new DOMException('Stopped', 'AbortError')); throw controller.signal.reason; }));
    await expect(decideProducts(config, { item, offers, preferences: {} }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
