import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../server/app.js';
import type { ServerConfig } from '../server/config.js';
import { ApiError } from '../server/errors.js';
import { containsEvidence, hasIdentifier, isCoupangProductUrl, matchesModel, publicImageUrl, verifiedPrice } from '../server/evidence.js';
import { budgetFromInstruction } from '../server/preferences.js';
import { SampleProvider } from '../server/sample-provider.js';

const config: ServerConfig = { exaKey: '', openAiKey: '', model: 'test-model', defaultMode: 'sample', timeoutMs: 45_000, orderFile: null };
const app = () => createApp({ config });
const discovery = (text: string, preferences?: object) => ({ mode: 'sample', selection: { text }, ...(preferences ? { preferences } : {}) });

describe('discovery and contextual refinement', () => {
  it.each(['Sony WH-1000XM5 headphones', 'Fjallraven Kanken backpack', 'IKEA TERTIAL desk lamp'])('supports %s and labels every sample honestly', async text => {
    const response = await request(app()).post('/discover').send(discovery(text)).expect(200);
    expect(response.body.mode).toBe('sample');
    expect(response.body.offers).toHaveLength(3);
    expect(response.body.offers[0].match).toBe('exact');
    expect(response.body.offers[0].differences).toEqual([]);
    expect(response.body.offers.every((offer: any) => offer.dataOrigin === 'sample' && offer.sourceUrl === null && offer.shipping === null && offer.availability === null)).toBe(true);
    expect(response.body.warnings.join(' ')).toContain('not verified Coupang listings');
  });

  it('preserves the original target when a budget narrows the alternatives', async () => {
    const server = app();
    const initial = await request(server).post('/discover').send(discovery('Sony WH-1000XM5 headphones')).expect(200);
    const refined = await request(server).post('/refine').send({ sessionId: initial.body.sessionId, instruction: 'Find something similar under KRW 50,000' }).expect(200);
    expect(refined.body.interpretation).toEqual(initial.body.interpretation);
    expect(refined.body.sessionId).not.toBe(initial.body.sessionId);
    expect(refined.body.offers).toHaveLength(1);
    expect(refined.body.offers[0].title).toContain('Soundcore');
    expect(refined.body.offers[0].currency).toBe('KRW');
    expect(refined.body.offers[0].price).toBeLessThanOrEqual(50_000);
  });

  it('never converts foreign prices to satisfy a budget', async () => {
    const response = await request(app()).post('/discover').send(discovery('headphones', { budget: 100, currency: 'USD' })).expect(200);
    expect(response.body.offers).toHaveLength(1);
    expect(response.body.offers[0].currency).toBe('USD');
    expect(response.body.offers[0].price).toBe(79.95);
  });

  it('asks for an explicit currency when the buyer supplies an ambiguous budget', async () => {
    await request(app()).post('/discover').send(discovery('headphones under $50')).expect(422).expect(res => expect(res.body.error.code).toBe('CURRENCY_REQUIRED'));
  });

  it('returns an empty result for unrelated items instead of a fabricated sample match', async () => {
    const response = await request(app()).post('/discover').send(discovery('unicorn space telescope')).expect(200);
    expect(response.body.offers).toEqual([]);
    expect(response.body.warnings.join(' ')).toContain('No sample items match');
    const colored = await request(app()).post('/discover').send(discovery('black ski helmet')).expect(200);
    expect(colored.body.offers).toEqual([]);
  });

  it('does not switch product types because another sample shares a color', async () => {
    const server = app();
    const initial = await request(server).post('/discover').send(discovery('Sony WH-1000XM5 black wireless headphones')).expect(200);
    const refined = await request(server).post('/refine').send({ sessionId: initial.body.sessionId, instruction: 'Find something similar under KRW 50,000' }).expect(200);
    expect(refined.body.offers).toHaveLength(1);
    expect(refined.body.offers[0].title).toContain('Soundcore');
  });

  it('does not pretend to use vision in sample mode', async () => {
    const response = await request(app()).post('/discover').send({ mode: 'sample', selection: { imageDataUrl: 'data:image/png;base64,AAAA' } }).expect(422);
    expect(response.body.error.code).toBe('IMAGE_DESCRIPTION_REQUIRED');
  });

  it('rejects missing/invalid selections and expired refinement sessions', async () => {
    await request(app()).post('/discover').send({ selection: {} }).expect(400);
    await request(app()).post('/discover').send({ selection: { imageUrl: 'http://localhost/private' } }).expect(400);
    await request(app()).post('/refine').send({ sessionId: '41bb6a30-ab2d-4c27-a825-2bbf0e9d925b', instruction: 'cheaper' }).expect(410);
  });
});

describe('live isolation and cancellation', () => {
  it('reports missing credentials without exposing values', async () => {
    const response = await request(app()).get('/health').expect(200);
    expect(response.body.liveAvailable).toBe(false);
    expect(response.body.missingKeys).toEqual(['EXA_API_KEY', 'OPENAI_API_KEY']);
    await request(app()).post('/discover').send({ selection: { text: 'headphones' }, mode: 'live' }).expect(503).expect(res => expect(res.body.error.code).toBe('LIVE_NOT_CONFIGURED'));
  });

  it('does not fall back to samples when live retrieval fails', async () => {
    const sample = new SampleProvider();
    const sampleSearch = vi.spyOn(sample, 'search');
    const live = new SampleProvider();
    vi.spyOn(live, 'search').mockRejectedValue(new ApiError(502, 'PROVIDER_FAILED', 'Exa failed'));
    const server = createApp({ config: { ...config, exaKey: 'configured', openAiKey: 'configured' }, sampleProvider: sample, liveProvider: live });
    await request(server).post('/discover').send({ selection: { text: 'headphones' }, mode: 'live' }).expect(502);
    expect(sampleSearch).not.toHaveBeenCalled();
  });

  it('times out and aborts an upstream workflow', async () => {
    const live = new SampleProvider();
    let capturedSignal: AbortSignal | undefined;
    vi.spyOn(live, 'search').mockImplementation(async (_item, _preferences, signal) => { capturedSignal = signal; return await new Promise(() => {}); });
    const server = createApp({ config: { ...config, exaKey: 'configured', openAiKey: 'configured', timeoutMs: 15 }, liveProvider: live });
    const response = await request(server).post('/discover').send({ selection: { text: 'headphones' }, mode: 'live' }).expect(504);
    expect(response.body.error.retryable).toBe(true);
    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe('demo purchase integrity', () => {
  async function prepared(server = app()) {
    const response = await request(server).post('/discover').send(discovery('Sony WH-1000XM5 headphones')).expect(200);
    return { server, body: { sessionId: response.body.sessionId, offerId: response.body.offers[0].id, variant: 'Black', confirmationId: 'same-confirmation-123', confirmed: true } };
  }

  it('makes duplicate confirmation idempotent', async () => {
    const { server, body } = await prepared();
    const first = await request(server).post('/demo-orders').send(body).expect(201);
    const duplicate = await request(server).post('/demo-orders').send(body).expect(200);
    expect(duplicate.body).toEqual(first.body);
    expect(first.body.status).toBe('simulated');
    expect(first.body.message).toContain('No payment taken');
  });

  it('rejects unconfirmed orders, changed selections, and arbitrary prices', async () => {
    const { server, body } = await prepared();
    await request(server).post('/demo-orders').send({ ...body, confirmed: false }).expect(400);
    await request(server).post('/demo-orders').send({ ...body, price: 1 }).expect(400);
    await request(server).post('/demo-orders').send({ ...body, offerId: 'invented-offer' }).expect(409);
    await request(server).post('/demo-orders').send({ ...body, variant: 'Not a real option' }).expect(422);
    await request(server).post('/demo-orders').send({ ...body, variant: undefined }).expect(422);
  });

  it('does not let an old confirmation authorize a different variant', async () => {
    const { server, body } = await prepared();
    await request(server).post('/demo-orders').send(body).expect(201);
    const conflict = await request(server).post('/demo-orders').send({ ...body, variant: 'Silver' }).expect(409);
    expect(conflict.body.error.code).toBe('CONFIRMATION_CONFLICT');
  });

  it('returns the same saved demo order after a server restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'needle-order-test-'));
    const orderFile = join(directory, 'orders.sqlite');
    const instances: ReturnType<typeof createApp>[] = [];
    try {
      const firstServer = createApp({ config: { ...config, orderFile: null, databaseFile: orderFile } });
      instances.push(firstServer);
      const { body } = await prepared(firstServer);
      const first = await request(firstServer).post('/demo-orders').send(body).expect(201);
      const restarted = createApp({ config: { ...config, orderFile: null, databaseFile: orderFile } });
      instances.push(restarted);
      const retry = await request(restarted).post('/demo-orders').send(body).expect(200);
      expect(retry.body.id).toBe(first.body.id);
    } finally {
      for (const instance of instances) instance.locals.database.close();
      if (existsSync(orderFile)) unlinkSync(orderFile);
      rmdirSync(directory);
    }
  });
});

describe('source evidence and local server boundaries', () => {
  it('only accepts actual Coupang product URLs for live offers', () => {
    expect(isCoupangProductUrl('https://www.coupang.com/vp/products/123?itemId=456')).toBe(true);
    for (const url of ['https://coupang.com.evil.test/vp/products/123', 'https://evil.test/vp/products/123', 'http://www.coupang.com/vp/products/123', 'https://www.coupang.com/np/search?q=lamp', 'https://user:pass@www.coupang.com/vp/products/123']) expect(isCoupangProductUrl(url)).toBe(false);
  });

  it('rejects unsupported prices, ambiguous currency, and missing evidence', () => {
    expect(verifiedPrice('Price: KRW 49,000', 49000, 'KRW', 'KRW 49,000')).toEqual({ price: 49000, currency: 'KRW' });
    expect(verifiedPrice('Price: $49', 49, 'USD', '$49')).toEqual({ price: null, currency: null });
    expect(verifiedPrice('Price: KRW 49,000', 40000, 'KRW', 'KRW 49,000')).toEqual({ price: null, currency: null });
    expect(verifiedPrice('Price unavailable', 49000, 'KRW', 'KRW 49,000')).toEqual({ price: null, currency: null });
    expect(verifiedPrice('Price: KRW 49,000', 49, 'KRW', 'KRW 49.000')).toEqual({ price: null, currency: null });
    expect(verifiedPrice('Price: KRW 49000. Order 49 today.', 49, 'KRW', 'KRW 49000. Order 49')).toEqual({ price: null, currency: null });
    expect(verifiedPrice('Price: KRW 49,000', 49, 'KRW', 'KRW 49,000')).toEqual({ price: null, currency: null });
    expect(containsEvidence('Shipping unknown', 'arrives tomorrow')).toBe(false);
    expect(hasIdentifier('Sony WH-1000XM5 wireless headphones', 'WH1000XM5')).toBe(true);
    expect(hasIdentifier('Sony WH-1000XM50 wireless headphones', 'WH1000XM5')).toBe(false);
    expect(matchesModel('Apple iPhone 15 Pro Max', 'iPhone 15 Pro')).toBe(false);
    expect(matchesModel('Apple iPhone 15 Pro', 'iPhone 15 Pro')).toBe(true);
    expect(matchesModel('Sony WH-1000XM5 Max', 'WH1000XM5')).toBe(false);
  });

  it('rejects private and unsafe image URLs', () => {
    expect(publicImageUrl('https://images.example.com/photo.jpg')).toBe('https://images.example.com/photo.jpg');
    for (const url of ['https://127.0.0.1/image', 'https://10.0.0.1/photo', 'https://172.20.0.1/photo', 'https://localhost/photo', 'data:image/svg+xml,bad', 'http://images.example.com/photo']) expect(publicImageUrl(url)).toBeNull();
  });

  it('blocks cross-origin web requests while accepting the local panel', async () => {
    await request(app()).get('/health').set('Origin', 'https://unrelated.example').expect(403);
    await request(app()).get('/health').set('Origin', 'http://127.0.0.1:5173').expect(200).expect('Access-Control-Allow-Origin', 'http://127.0.0.1:5173');
    await request(app()).post('/discover').type('form').send({ text: 'headphones' }).expect(415);
    await request(app()).get('/health').set('Host', 'attacker.example').expect(403);
  });

  it('does not assume a dollar budget means the previous KRW preference', () => {
    expect(() => budgetFromInstruction('under $50', { currency: 'KRW', budget: 50_000 })).toThrow('Add a currency');
  });

  it('supports abbreviated budgets without truncating the amount', () => {
    expect(budgetFromInstruction('under KRW50k')).toEqual({ currency: 'KRW', budget: 50000 });
    expect(budgetFromInstruction('under KRW 1.5m')).toEqual({ currency: 'KRW', budget: 1500000 });
  });

  it('requires a new budget when changing currencies', () => {
    expect(() => budgetFromInstruction('show USD prices', { currency: 'KRW', budget: 50000 })).toThrow('Specify a new budget');
    expect(budgetFromInstruction('under USD 50', { currency: 'KRW', budget: 50000 })).toEqual({ currency: 'USD', budget: 50 });
  });

  it('accepts short brands at word boundaries and rejects malformed currency safely', () => {
    expect(hasIdentifier('LG UltraGear monitor', 'LG')).toBe(true);
    expect(hasIdentifier('HP Pavilion laptop', 'HP')).toBe(true);
    expect(hasIdentifier('ALGAE green', 'LG')).toBe(false);
    expect(verifiedPrice('Price [ 500', 500, '[', '[ 500')).toEqual({ price: null, currency: null });
  });
});
