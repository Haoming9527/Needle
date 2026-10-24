import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../server/app.js';
const apps: ReturnType<typeof createApp>[] = [];
function setup() { const app = createApp({ config: { exaKey: '', openAiKey: '', gatewayKey: '', model: 'test', defaultMode: 'sample', timeoutMs: 5000, databaseFile: ':memory:', orderFile: null } }); apps.push(app); return request(app); }
afterEach(() => apps.splice(0).forEach(app => app.locals.database.close()));
const inspiration = { id: 'popup-first', label: 'Meal prep', summary: 'Meal prep recipes', sourceOrigin: 'https://recipes.example/path?private=hidden', sourceTitle: 'Recipes', tags: ['meal-prep'], provenance: 'observed' };

describe('semantic cursor inspiration identity', () => {
  it('merges repeated popup saves, preserves collection references, and permits a fresh save after removal', async () => {
    const api = setup(); await api.post('/intent/consent').send({ enabled: true }).expect(200);
    const first = (await api.post('/saved-items').send(inspiration).expect(200)).body.item;
    const collection = (await api.post('/collections').send({ name: 'Ideas' }).expect(200)).body.collection;
    const duplicate = (await api.post('/saved-items').send({ ...inspiration, id: 'popup-second', sourceOrigin: 'https://recipes.example/other', summary: '  MEAL   prep recipes  ', collectionId: collection.id }).expect(200)).body;
    expect(duplicate.items).toHaveLength(1);
    expect(duplicate.item).toMatchObject({ id: first.id, generation: first.generation, sourceOrigin: 'https://recipes.example' });
    expect((await api.get('/collections').expect(200)).body.collections[0].itemIds).toEqual([first.id]);
    let observations = (await api.get('/intent').expect(200)).body.observations;
    expect(observations).toHaveLength(1);
    expect(observations[0].action).toBe('save');
    await api.post(`/saved-items/${first.id}/remove`).send({}).expect(200);
    expect((await api.get('/intent').expect(200)).body.observations).toEqual([]);
    expect((await api.get('/collections').expect(200)).body.collections[0].itemIds).toEqual([]);
    const restored = (await api.post('/saved-items').send(inspiration).expect(200)).body.item;
    expect(restored.generation).not.toBe(first.generation);
    observations = (await api.get('/intent').expect(200)).body.observations;
    expect(observations).toHaveLength(1);
    expect(observations[0].action).toBe('save');
  });
  it('keeps different content and independent sites distinct', async () => {
    const api = setup();
    await api.post('/saved-items').send(inspiration).expect(200);
    await api.post('/saved-items').send({ ...inspiration, id: 'different-context', summary: 'Cycle commuting' }).expect(200);
    await api.post('/saved-items').send({ ...inspiration, id: 'different-site', sourceOrigin: 'https://another.example' }).expect(200);
    expect((await api.get('/saved-items').expect(200)).body.items).toHaveLength(3);
  });
});
