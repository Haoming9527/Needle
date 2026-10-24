import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
import { ATTENTION_DWELL_MS, DEMO_ATTENTION_SOURCES, attentionSourceForUrl, type AttentionCapture } from '../shared/attention.js';
const apps: ReturnType<typeof createApp>[] = [];
function setup() { const app = createApp({ config: { exaKey: '', openAiKey: '', gatewayKey: '', model: 'test', defaultMode: 'sample', timeoutMs: 5000, databaseFile: ':memory:', orderFile: null } }); apps.push(app); return request(app); }
afterEach(() => apps.splice(0).forEach(app => app.locals.database.close()));
function capture(sourceId: AttentionCapture['sourceId'] = 'recipe-guide'): AttentionCapture {
  const source = DEMO_ATTENTION_SOURCES[sourceId];
  return { id: randomUUID(), sessionId: randomUUID(), pageInstanceId: randomUUID(), sourceId, targetId: source.targetId, action: 'dwell', measurement: { dwellMs: ATTENTION_DWELL_MS, visitOrdinal: 1 }, capturedAt: new Date().toISOString(), documentUrl: `http://localhost:5173${source.path}` };
}
async function enable(api: ReturnType<typeof setup>) {
  await api.post('/intent/consent').send({ enabled: true }).expect(200);
  await api.post('/intent/attention/consent').send({ enabled: true }).expect(200);
}

describe('measured attention on controlled demo sources', () => {
  it('requires separate attention opt-in, pauses with memory, and resets both consents', async () => {
    const api = setup();
    expect((await api.get('/intent').expect(200)).body).toMatchObject({ consent: false, attentionConsent: false });
    await api.post('/intent/attention/consent').send({ enabled: true }).expect(409);
    await api.post('/intent/attention').send(capture()).expect(409);
    await api.post('/intent/consent').send({ enabled: true }).expect(200);
    await api.post('/intent/attention').send(capture()).expect(409);
    await api.post('/intent/attention/consent').send({ enabled: true }).expect(200);
    await api.post('/intent/attention').send(capture()).expect(200);
    const paused = (await api.post('/intent/consent').send({ enabled: false }).expect(200)).body;
    expect(paused).toMatchObject({ consent: false, attentionConsent: false });
    expect(paused.observations).toHaveLength(1);
    await api.post('/intent/consent').send({ enabled: true }).expect(200);
    await api.post('/intent/attention').send(capture()).expect(409);
    expect((await api.post('/intent/reset').send({}).expect(200)).body).toEqual({ consent: false, attentionConsent: false, observations: [], hypotheses: [] });
  });
  it('persists measurement provenance and stitches two local demo sources without claiming external origins', async () => {
    const api = setup(); await enable(api);
    const recipe = capture(), commute = capture('commute-guide');
    const first = (await api.post('/intent/attention').send(recipe).expect(200)).body;
    expect(first.hypotheses).toEqual([]);
    expect(first.observations[0]).toMatchObject({ sourceOrigin: 'http://localhost:5173', provenance: 'demo_fixture', entityKey: 'demo:recipe-guide:meal-prep-reading', capture: { method: 'measured_cursor', environment: 'controlled_demo', actualOrigin: 'http://localhost:5173', sessionId: recipe.sessionId, pageInstanceId: recipe.pageInstanceId, sourceId: recipe.sourceId, targetId: recipe.targetId, dwellMs: 2000, visitOrdinal: 1, capturedAt: recipe.capturedAt } });
    const state = (await api.post('/intent/attention').send(commute).expect(200)).body;
    expect(state.hypotheses[0]).toMatchObject({ interest: 'tentative', readiness: 'exploring', evidencePoints: 4 });
    expect(state.hypotheses[0].connection.observations.map((value: any) => value.capture.sourceId)).toEqual(['recipe-guide', 'commute-guide']);
    expect(state.hypotheses[0].explanation).toContain('not verified external browsing');
    expect(state.hypotheses[0].connection).not.toHaveProperty('productRationale');
  });
  it('caps repeat visits per demo source and deduplicates retry and new page instance events', async () => {
    const api = setup(); await enable(api); const recipe = capture();
    await api.post('/intent/attention').send(recipe).expect(200);
    await api.post('/intent/attention').send(recipe).expect(200);
    const revisit = { ...recipe, id: randomUUID(), pageInstanceId: randomUUID(), documentUrl: 'http://127.0.0.1:5173/recipe-demo.html', action: 'revisit', measurement: { dwellMs: 4000, visitOrdinal: 2 } };
    const sameSource = (await api.post('/intent/attention').send(revisit).expect(200)).body;
    expect(sameSource.observations).toHaveLength(1);
    expect(sameSource.observations[0]).toMatchObject({ id: recipe.id, action: 'revisit', capture: { pageInstanceId: revisit.pageInstanceId, visitOrdinal: 2, dwellMs: 4000 } });
    expect(sameSource.hypotheses).toEqual([]);
    const state = (await api.post('/intent/attention').send(capture('commute-guide')).expect(200)).body;
    expect(state.hypotheses[0].evidencePoints).toBe(4);
  });
  it('rejects mismatched source or target, short dwell, false revisits and invalid identifiers', async () => {
    const api = setup(); await enable(api); const event = capture();
    for (const patch of [
      { sourceId: 'commute-guide' }, { targetId: 'arbitrary-region' }, { documentUrl: 'https://recipes.example/recipe-demo.html' },
      { documentUrl: 'http://localhost:5173/panel.html' }, { documentUrl: 'http://localhost:4318/recipe-demo.html' },
      { measurement: { dwellMs: 1999, visitOrdinal: 1 } }, { action: 'revisit' }, { id: 'invalid' }, { capturedAt: 'yesterday' },
    ]) await api.post('/intent/attention').send({ ...event, ...patch }).expect(400);
    expect((await api.get('/intent').expect(200)).body.observations).toEqual([]);
  });
  it('does not combine measured demo sources with replay evidence or ordinary local recommendations', async () => {
    const api = setup(); await enable(api);
    await api.post('/intent/attention').send(capture()).expect(200);
    const body = { id: 'other', action: 'dwell', sourceOrigin: 'http://localhost:5173', sourceTitle: 'Local recommendation', summary: 'Cycle commuting', tags: ['cycle-commute'], provenance: 'demo_fixture' };
    await api.post('/intent/observations').send(body).expect(200);
    await api.post('/intent/observations').send({ ...body, id: 'replay', sourceOrigin: 'https://cycling.example' }).expect(200);
    expect((await api.get('/intent').expect(200)).body.hypotheses).toEqual([]);
    // Ordinary observation input cannot smuggle trusted measured-source metadata.
    await api.post('/intent/observations').send({ ...body, id: 'spoof', capture: { method: 'measured_cursor' } }).expect(400);
  });
  it('only recognizes registered pages on the allowed development origins', () => {
    expect(attentionSourceForUrl('http://127.0.0.1:5173/recipe-demo.html?view=reading')?.id).toBe('recipe-guide');
    for (const url of ['https://localhost:5173/recipe-demo.html', 'http://localhost:5173/recipe-demo.html/extra', 'http://localhost:5173/not-demo.html', 'http://user:pass@localhost:5173/recipe-demo.html', 'http://evil.example/recipe-demo.html']) expect(attentionSourceForUrl(url)).toBeUndefined();
  });
});
