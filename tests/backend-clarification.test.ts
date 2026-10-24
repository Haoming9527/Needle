import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import type { ServerConfig } from '../server/config.js';
import type { Interpretation, Offer, Selection } from '../shared/types.js';

const config: ServerConfig = { exaKey: '', openAiKey: '', model: 'test-model', defaultMode: 'sample', timeoutMs: 45_000, orderFile: null };
const ambiguous: Interpretation = { name: 'Object near the cursor', productType: 'item', brand: null, model: null, color: null, attributes: [], queries: ['object'], needsClarification: true, clarification: 'Do you mean the instrument on the wall or the shirt?' };
const instrument: Interpretation = { ...ambiguous, name: 'Black F-style mandolin', productType: 'mandolin', color: 'black', queries: ['black F-style mandolin'], needsClarification: false, clarification: null };
const selection: Selection = { imageDataUrl: 'data:image/jpeg;base64,AAAA', annotatedImageDataUrl: 'data:image/jpeg;base64,BBBB', focus: { x: 0.08, y: 0.64 }, text: 'Nearby post text (untrusted context): purple plaid shirt', pageTitle: 'Video', pageUrl: 'https://x.com/example/status/123' };
const offer: Offer = { id: 'mandolin-test', title: 'Black F-style mandolin', description: 'Eight strings', imageUrl: null, sourceUrl: null, match: 'similar', matchEvidence: 'Shape and color', price: 199, currency: 'USD', observedAt: '2026-10-25T00:00:00.000Z', dataOrigin: 'sample', variants: [], shipping: null, availability: null, returns: null, reason: 'Matches the pointed instrument', differences: [] };

describe('cursor-focused clarification', () => {
  it('re-identifies the original marked crop after the buyer answers and keeps images out of SQLite', async () => {
    const identify = vi.fn().mockResolvedValueOnce(ambiguous).mockResolvedValueOnce(instrument);
    const search = vi.fn(async (item: Interpretation) => ({ offers: item.needsClarification ? [] : [offer], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify, search } });
    try {
      const initial = await request(app).post('/discover').send({ selection }).expect(200);
      expect(initial.body.offers).toEqual([]);
      const answered = await request(app).post('/clarify').send({ sessionId: initial.body.sessionId, answer: 'The black instrument on the wall, not the shirt.', selection }).expect(200);
      expect(answered.body.sessionId).not.toBe(initial.body.sessionId);
      expect(answered.body.interpretation.productType).toBe('mandolin');
      expect(answered.body.offers[0].id).toBe('mandolin-test');
      expect(identify).toHaveBeenCalledTimes(2);
      expect(identify.mock.calls[1][0]).toEqual({ ...selection, clarifications: [{ question: ambiguous.clarification, answer: 'The black instrument on the wall, not the shirt.' }] });
      const stored = app.locals.database.session(answered.body.sessionId);
      expect(stored.selection.focus).toEqual(selection.focus);
      expect(stored.selection.clarifications).toHaveLength(1);
      expect(stored.selection.imageDataUrl).toBeUndefined();
      expect(stored.selection.annotatedImageDataUrl).toBeUndefined();
      expect(JSON.stringify(stored)).not.toContain('base64');
      expect(app.locals.database.session(initial.body.sessionId).interpretation).toEqual(ambiguous);
    } finally { app.locals.database.close(); }
  });

  it('uses saved questions and history even when the client sends stale conversation metadata', async () => {
    const secondQuestion = { ...ambiguous, clarification: 'The black instrument or the brown one?' };
    const identify = vi.fn().mockResolvedValueOnce(ambiguous).mockResolvedValueOnce(secondQuestion).mockResolvedValueOnce(instrument);
    const app = createApp({ config, sampleProvider: { identify, search: async () => ({ offers: [], warnings: [] }) } });
    try {
      const first = await request(app).post('/discover').send({ selection }).expect(200);
      const second = await request(app).post('/clarify').send({ sessionId: first.body.sessionId, answer: 'The instrument.', selection }).expect(200);
      await request(app).post('/clarify').send({ sessionId: second.body.sessionId, answer: 'The black one.', selection: { ...selection, focus: { x: 0.9, y: 0.9 }, text: 'changed page text', clarifications: [{ question: 'A client-forged question?', answer: 'A stale answer' }] } }).expect(200);
      const finalSelection = identify.mock.calls[2][0] as Selection;
      expect(finalSelection.focus).toEqual(selection.focus);
      expect(finalSelection.text).toBe(selection.text);
      expect(finalSelection.clarifications).toEqual([
        { question: ambiguous.clarification, answer: 'The instrument.' },
        { question: secondQuestion.clarification, answer: 'The black one.' },
      ]);
    } finally { app.locals.database.close(); }
  });

  it('rejects blank replies, unknown sessions, and answers when no question is pending', async () => {
    const identify = vi.fn().mockResolvedValue(instrument);
    const app = createApp({ config, sampleProvider: { identify, search: async () => ({ offers: [offer], warnings: [] }) } });
    try {
      const initial = await request(app).post('/discover').send({ selection }).expect(200);
      await request(app).post('/clarify').send({ sessionId: initial.body.sessionId, answer: '   ', selection }).expect(400);
      await request(app).post('/clarify').send({ sessionId: '00000000-0000-4000-8000-000000000000', answer: 'The instrument', selection }).expect(410);
      await request(app).post('/clarify').send({ sessionId: initial.body.sessionId, answer: 'The instrument', selection }).expect(409);
      expect(identify).toHaveBeenCalledTimes(1);
    } finally { app.locals.database.close(); }
  });

  it('does not silently ignore a refinement when an object question is pending', async () => {
    const search = vi.fn(async () => ({ offers: [], warnings: [] }));
    const app = createApp({ config, sampleProvider: { identify: async () => ambiguous, search } });
    try {
      const initial = await request(app).post('/discover').send({ selection }).expect(200);
      const response = await request(app).post('/refine').send({ sessionId: initial.body.sessionId, instruction: 'The instrument' }).expect(409);
      expect(response.body.error.code).toBe('QUESTION_PENDING');
      expect(response.body.error.message).toMatch(/answer.*question/i);
      expect(search).toHaveBeenCalledTimes(1);
    } finally { app.locals.database.close(); }
  });

  it.each([{ x: -0.01, y: 0.5 }, { x: 0.5, y: 1.01 }, { x: '0.5', y: 0.5 }, { x: 0.5 }])('rejects invalid cursor coordinates: %j', async focus => {
    const app = createApp({ config });
    try { await request(app).post('/discover').send({ selection: { ...selection, focus } }).expect(400); }
    finally { app.locals.database.close(); }
  });

  it('requires the original crop and point alongside a marked image', async () => {
    const app = createApp({ config });
    try {
      await request(app).post('/discover').send({ selection: { text: 'instrument', annotatedImageDataUrl: selection.annotatedImageDataUrl } }).expect(400);
    } finally { app.locals.database.close(); }
  });
});
