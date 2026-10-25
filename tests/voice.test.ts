import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { NeedleDatabase } from '../server/storage/database.js';
import type { ServerConfig } from '../server/config.js';
import { installVoiceRoutes } from '../server/routes/voice.js';
import { ApiError } from '../server/errors.js';
import type { Interpretation, Offer, SearchResponse } from '../shared/types.js';

const sessionId = '11111111-1111-4111-8111-111111111111';
const question = 'Do you mean the black instrument on the wall or the shirt?';
const config: ServerConfig = { openAiKey: 'test-only', exaKey: '', model: 'test-model', defaultMode: 'sample', timeoutMs: 45_000, orderFile: null };
const item: Interpretation = { name: 'An object', productType: 'item', brand: null, model: null, color: null, attributes: [], queries: ['item'], needsClarification: true, clarification: question };
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...new Array(32).fill(0)]);
const recording = `data:audio/webm;codecs=opus;base64,${webm.toString('base64')}`;
let database: NeedleDatabase;

function application(options: Partial<ServerConfig> = {}) {
  const app = express(); app.use(express.json({ limit: '6mb' }));
  installVoiceRoutes(app, { ...config, ...options }, database);
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = error instanceof z.ZodError ? 400 : error instanceof ApiError ? error.status : 500;
    res.status(status).json({ error: { code: error instanceof ApiError ? error.code : 'INVALID_REQUEST', message: error.message } });
  };
  app.use(errors); return app;
}
function save(needsClarification = true, id = sessionId, offers: Offer[] = []) {
  const interpretation = { ...item, needsClarification, clarification: needsClarification ? question : null };
  const result: SearchResponse = { sessionId: id, interpretation, offers, warnings: [], mode: 'sample' };
  database.saveSession({ selection: { text: 'Object at the cursor' }, interpretation, preferences: {}, result });
}

beforeEach(() => { database = new NeedleDatabase(); save(); });
afterEach(() => { database.close(); vi.unstubAllGlobals(); });

describe('OpenAI voice question and answer endpoints', () => {
  it('speaks only the stored question using the configured OpenAI speech model', async () => {
    const audio = Buffer.from('ID3 sample speech bytes');
    const mock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(audio, { headers: { 'Content-Type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', mock);
    const response = await request(application({ speechModel: 'gpt-4o-mini-tts', speechVoice: 'coral' })).post('/voice/question').send({ sessionId }).expect(200);
    expect(mock.mock.calls[0][0]).toBe('https://api.openai.com/v1/audio/speech');
    expect(JSON.parse(String(mock.mock.calls[0][1]?.body))).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'coral', input: question, response_format: 'mp3' });
    expect(response.body).toEqual({ audioDataUrl: `data:audio/mpeg;base64,${audio.toString('base64')}` });
    await request(application()).post('/voice/question').send({ sessionId, text: 'Client-injected speech' }).expect(400);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(database.session(sessionId).selection).not.toHaveProperty('audioDataUrl');
  });

  it('uploads recorded bytes to OpenAI transcription and returns editable text without submitting it', async () => {
    const mock = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => Response.json({ text: '  The black instrument on the wall.  ', languages: [{ code: 'en' }] }));
    vi.stubGlobal('fetch', mock);
    const before = database.session(sessionId);
    const response = await request(application()).post('/voice/transcribe').send({ sessionId, audioDataUrl: recording }).expect(200);
    expect(response.body).toEqual({ text: 'The black instrument on the wall.' });
    expect(mock.mock.calls[0][0]).toBe('https://api.openai.com/v1/audio/transcriptions');
    const form = mock.mock.calls[0][1]?.body as FormData;
    expect(form.get('model')).toBe('gpt-transcribe');
    const file = form.get('file') as File;
    expect(file.type).toBe('audio/webm'); expect(file.name).toBe('audio.webm');
    expect(Buffer.from(await file.arrayBuffer())).toEqual(webm);
    expect(database.session(sessionId)).toEqual(before);
    expect(database.cart()).toEqual([]); expect(database.history()).toEqual([]);
  });

  it('requires OPENAI_API_KEY even when a gateway key exists', async () => {
    const mock = vi.fn(); vi.stubGlobal('fetch', mock);
    const response = await request(application({ openAiKey: '', gatewayKey: 'gateway-test' })).post('/voice/question').send({ sessionId }).expect(503);
    expect(response.body.error.code).toBe('VOICE_NOT_CONFIGURED');
    await request(application({ openAiKey: '' })).post('/voice/transcribe').send({ sessionId, audioDataUrl: recording }).expect(503);
    expect(mock).not.toHaveBeenCalled();
  });

  it('requires a current question for both endpoints', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const resolvedId = '22222222-2222-4222-8222-222222222222';
    save(false, resolvedId, [{ id: 'found', title: 'Headphones', description: 'Headphones', imageUrl: null, sourceUrl: null, match: 'similar', matchEvidence: 'Same product type', price: 50, currency: 'USD', observedAt: '2026-10-25T00:00:00Z', dataOrigin: 'sample', variants: [], shipping: null, availability: null, returns: null, reason: '', differences: [] }]);
    const expiredId = '33333333-3333-4333-8333-333333333333';
    for (const path of ['/voice/question', '/voice/transcribe']) {
      const extra = path.endsWith('transcribe') ? { audioDataUrl: recording } : {};
      await request(application()).post(path).send({ sessionId: resolvedId, ...extra }).expect(409);
      await request(application()).post(path).send({ sessionId: expiredId, ...extra }).expect(410);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows speech and transcription to recover a legacy empty-result session', async () => {
    const emptyId = '44444444-4444-4444-8444-444444444444'; save(false, emptyId);
    const mock = vi.fn().mockResolvedValueOnce(new Response(Buffer.from('ID3 recovery question'), { headers: { 'Content-Type': 'audio/mpeg' } }))
      .mockResolvedValueOnce(Response.json({ text: 'A similar one is fine.' }));
    vi.stubGlobal('fetch', mock);
    await request(application()).post('/voice/question').send({ sessionId: emptyId }).expect(200);
    expect(JSON.parse(mock.mock.calls[0][1].body).input).toContain('could not find a suitable item');
    const response = await request(application()).post('/voice/transcribe').send({ sessionId: emptyId, audioDataUrl: recording }).expect(200);
    expect(response.body.text).toBe('A similar one is fine.');
    expect(database.session(emptyId).result.offers).toEqual([]);
    expect(database.cart()).toEqual([]);
  });

  it.each([
    'https://example.com/voice.webm',
    'data:audio/webm;base64,not-valid!',
    'data:audio/webm;base64,AAAA',
    'data:audio/webm;base64,YWJjZGVmZ2hpamts',
    `data:audio/mp4;base64,${webm.toString('base64')}`,
    `data:audio/ogg;base64,${webm.toString('base64')}`,
  ])('rejects malformed or unsupported recordings without provider calls (%s)', async audioDataUrl => {
    vi.stubGlobal('fetch', vi.fn());
    await request(application()).post('/voice/transcribe').send({ sessionId, audioDataUrl }).expect(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects oversized recordings before decoding or transmitting them', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await request(application()).post('/voice/transcribe').send({ sessionId, audioDataUrl: `data:audio/webm;base64,${'A'.repeat(4_000_000)}` }).expect(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports silence and overlong transcripts without pretending they are answers', async () => {
    const mock = vi.fn().mockResolvedValueOnce(Response.json({ text: '   ' })).mockResolvedValueOnce(Response.json({ text: 'a'.repeat(1001) }));
    vi.stubGlobal('fetch', mock);
    const silent = await request(application()).post('/voice/transcribe').send({ sessionId, audioDataUrl: recording }).expect(422);
    expect(silent.body.error.code).toBe('NO_SPEECH');
    const long = await request(application()).post('/voice/transcribe').send({ sessionId, audioDataUrl: recording }).expect(422);
    expect(long.body.error.code).toBe('ANSWER_TOO_LONG');
  });

  it.each([[401, 503, 'VOICE_CREDENTIALS'], [429, 429, 'VOICE_LIMIT'], [500, 502, 'VOICE_UNAVAILABLE']])('redacts provider failures (%s)', async (status, expected, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'private submitted speech and credentials', type: 'test', code: 'test' } }, { status: Number(status) })));
    const response = await request(application()).post('/voice/question').send({ sessionId }).expect(Number(expected));
    expect(response.body.error.code).toBe(code);
    expect(JSON.stringify(response.body)).not.toContain('private submitted');
  });

  it('aborts upstream work when the voice deadline expires', async () => {
    let upstreamSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      upstreamSignal = init?.signal ?? undefined;
      upstreamSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    })));
    const response = await request(application({ timeoutMs: 25 })).post('/voice/question').send({ sessionId }).expect(504);
    expect(response.body.error.code).toBe('VOICE_TIMEOUT'); expect(upstreamSignal?.aborted).toBe(true);
  });

  it('aborts transcription when the buyer closes the requesting connection', async () => {
    let upstreamSignal: AbortSignal | undefined;
    const mock = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      upstreamSignal = init?.signal ?? undefined;
      upstreamSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', mock);
    const response = request(application()).post('/voice/transcribe').send({ sessionId, audioDataUrl: recording });
    const completion = response.then(() => undefined, () => undefined);
    await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    response.abort();
    await vi.waitFor(() => expect(upstreamSignal?.aborted).toBe(true));
    await completion;
  });
});
