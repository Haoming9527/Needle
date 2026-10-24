import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createApp } from '../server/app.js';
import { NeedleDatabase } from '../server/database.js';
import type { ServerConfig } from '../server/config.js';

const config: ServerConfig = { exaKey: '', openAiKey: '', model: 'test-model', defaultMode: 'sample', timeoutMs: 45000, orderFile: null };
const instances: ReturnType<typeof createApp>[] = [];
const folders: string[] = [];
const app = (extra: Partial<ServerConfig> = {}) => { const value = createApp({ config: { ...config, ...extra } }); instances.push(value); return value; };
afterEach(() => { for (const value of instances.splice(0)) value.locals.database.close(); for (const folder of folders.splice(0)) rmSync(folder, { recursive: true }); });
async function find(server: ReturnType<typeof app>, text = 'Shure SM7B podcast microphone') {
  const response = await request(server).post('/discover').send({ selection: { text, imageDataUrl: 'data:image/png;base64,AAAA' } }).expect(200);
  return { sessionId: response.body.sessionId as string, offerId: response.body.offers[0].id as string, variant: response.body.offers[0].variants[0] as string };
}

describe('SQLite catalog, cart, and purchase history', () => {
  it.each(['podcast microphone', 'microphone boom arm', 'laptop'])('seeds discoverable %s records', async text => {
    const response = await request(app()).post('/discover').send({ selection: { text } }).expect(200);
    expect(response.body.offers).toHaveLength(3);
    expect(response.body.offers.every((offer: { dataOrigin: string }) => offer.dataOrigin === 'sample')).toBe(true);
  });
  it('persists the cart and search context across restart without storing raw captures', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'needle-sqlite-')); folders.push(directory);
    const databaseFile = join(directory, 'needle.sqlite');
    const first = app({ databaseFile });
    const selection = await find(first);
    await request(first).post('/cart').send({ ...selection, quantity: 2 }).expect(200);
    const second = app({ databaseFile });
    const cart = await request(second).get('/cart').expect(200);
    expect(cart.body.items[0]).toMatchObject({ quantity: 2, variant: 'Black' });
    await request(second).post('/refine').send({ sessionId: selection.sessionId, instruction: 'under KRW 100000' }).expect(200);
    expect(readFileSync(databaseFile).includes(Buffer.from('data:image/'))).toBe(false);
  });
  it('validates variants and updates quantities and removes cart rows', async () => {
    const server = app(); const selection = await find(server, 'Sony WH-1000XM5 headphones');
    await request(server).post('/cart').send({ ...selection, variant: undefined }).expect(422);
    await request(server).post('/cart').send({ ...selection, variant: 'Purple' }).expect(422);
    await request(server).post('/cart').send({ ...selection, quantity: -1 }).expect(400);
    const added = await request(server).post('/cart').send(selection).expect(200);
    const id = added.body.items[0].id;
    const updated = await request(server).post(`/cart/${id}/quantity`).send({ quantity: 3 }).expect(200);
    expect(updated.body.items[0].quantity).toBe(3);
    await request(server).post('/cart').send(selection).expect(200).expect(res => expect(res.body.items[0].quantity).toBe(4));
    await request(server).post(`/cart/${id}/remove`).send({}).expect(200).expect(res => expect(res.body.items).toEqual([]));
  });
  it('adds a cart operation once across retries and rejects changed payloads', async () => {
    const server = app(); const selection = await find(server);
    const body = { ...selection, quantity: 2, operationId: 'cart-retry-123' };
    const first = await request(server).post('/cart').send(body).expect(200);
    const retry = await request(server).post('/cart').send(body).expect(200);
    expect(retry.body.items).toEqual(first.body.items);
    expect(retry.body.items[0].quantity).toBe(2);
    await request(server).post('/cart').send({ ...body, quantity: 3 }).expect(409);
    await request(server).post('/cart').send({ ...body, operationId: 'cart-new-action-456' }).expect(200)
      .expect(res => expect(res.body.items[0].quantity).toBe(4));
  });
  it('persists cart retry guards across restart and does not restore cleared items', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'needle-cart-retry-')); folders.push(directory);
    const databaseFile = join(directory, 'needle.sqlite');
    const first = app({ databaseFile }); const selection = await find(first);
    const body = { ...selection, operationId: 'cart-persisted-123' };
    await request(first).post('/cart').send(body).expect(200);
    const second = app({ databaseFile });
    await request(second).post('/cart').send(body).expect(200).expect(res => expect(res.body.items[0].quantity).toBe(1));
    await request(second).post('/cart/clear').send({}).expect(200);
    await request(second).post('/cart').send(body).expect(200).expect(res => expect(res.body.items).toEqual([]));
    await request(second).post('/cart').send({ ...body, operationId: 'cart-after-clear-456' }).expect(200)
      .expect(res => expect(res.body.items[0].quantity).toBe(1));
  });
  it('does not reserve a cart retry identifier when validation fails', async () => {
    const server = app(); const selection = await find(server);
    const body = { ...selection, operationId: 'cart-validation-123' };
    await request(server).post('/cart').send({ ...body, variant: 'Invalid' }).expect(422);
    await request(server).post('/cart').send(body).expect(200).expect(res => expect(res.body.items[0].quantity).toBe(1));
  });
  it('atomically purchases a cart snapshot once and retains its quantity in history', async () => {
    const server = app(); const selection = await find(server);
    const added = await request(server).post('/cart').send({ ...selection, quantity: 2 }).expect(200);
    const body = { ...selection, cartItemId: added.body.items[0].id, quantity: 2, confirmationId: 'sqlite-checkout-123', confirmed: true };
    const first = await request(server).post('/orders').send(body).expect(201);
    const retry = await request(server).post('/orders').send(body).expect(200);
    expect(retry.body.id).toBe(first.body.id);
    expect(first.body).toMatchObject({ quantity: 2, status: 'simulated' });
    await request(server).get('/cart').expect(200).expect(res => expect(res.body.items).toEqual([]));
    await request(server).get('/orders').expect(200).expect(res => expect(res.body.orders).toHaveLength(1));
    await request(server).post('/orders').send({ ...body, quantity: 1 }).expect(409);
  });
  it('refuses stale cart checkout without removing the changed item', async () => {
    const server = app(); const selection = await find(server);
    const added = await request(server).post('/cart').send(selection).expect(200); const id = added.body.items[0].id;
    await request(server).post(`/cart/${id}/quantity`).send({ quantity: 3 }).expect(200);
    await request(server).post('/orders').send({ ...selection, cartItemId: id, quantity: 1, confirmationId: 'stale-cart-123', confirmed: true }).expect(409);
    await request(server).get('/orders').expect(200).expect(res => expect(res.body.orders).toEqual([]));
    await request(server).get('/cart').expect(200).expect(res => expect(res.body.items[0].quantity).toBe(3));
  });
  it('imports old receipts once without altering the original file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'needle-migration-')); folders.push(directory);
    const legacy = join(directory, 'orders.json'); const dbPath = join(directory, 'needle.sqlite');
    const body = { sessionId: 'old-session', offerId: 'old-offer', variant: 'Black', confirmationId: 'old-confirmation', confirmed: true as const };
    const fingerprint = createHash('sha256').update(JSON.stringify([body.sessionId, body.offerId, body.variant])).digest('hex');
    const order = { id: 'NDL-EXISTING', confirmationId: body.confirmationId, createdAt: new Date().toISOString(), status: 'simulated', title: 'Existing purchase' };
    const original = JSON.stringify([[body.confirmationId, { fingerprint, order }]]); writeFileSync(legacy, original);
    const first = new NeedleDatabase(dbPath, legacy); expect(first.previous(body)?.id).toBe('NDL-EXISTING'); first.close();
    const second = new NeedleDatabase(dbPath, legacy); expect(second.history()).toHaveLength(1); second.close();
    expect(readFileSync(legacy, 'utf8')).toBe(original);
  });
});

describe('collection clear controls', () => {
  it('clears only cart entries and preserves history, catalog, and search sessions', async () => {
    const server = app(); const selection = await find(server);
    await request(server).post('/orders').send({ ...selection, confirmationId: 'keep-history-123', confirmed: true }).expect(201);
    await request(server).post('/cart').send(selection).expect(200);
    const catalogBefore = server.locals.database.catalog();
    await request(server).post('/cart/clear').send({}).expect(200).expect(res => expect(res.body).toEqual({ items: [] }));
    await request(server).get('/cart').expect(200).expect(res => expect(res.body.items).toEqual([]));
    await request(server).get('/orders').expect(200).expect(res => expect(res.body.orders).toHaveLength(1));
    expect(server.locals.database.catalog()).toEqual(catalogBefore);
    await request(server).post('/cart').send(selection).expect(200).expect(res => expect(res.body.items).toHaveLength(1));
  });

  it('clears only order history and blocks stale confirmation replay without recreating a receipt', async () => {
    const server = app(); const selection = await find(server);
    const purchase = { ...selection, confirmationId: 'cleared-purchase-123', confirmed: true };
    await request(server).post('/orders').send(purchase).expect(201);
    await request(server).post('/cart').send(selection).expect(200);
    const catalogBefore = server.locals.database.catalog();
    await request(server).post('/orders/clear').send({}).expect(200).expect(res => expect(res.body).toEqual({ orders: [] }));
    await request(server).get('/orders').expect(200).expect(res => expect(res.body.orders).toEqual([]));
    await request(server).get('/cart').expect(200).expect(res => expect(res.body.items).toHaveLength(1));
    expect(server.locals.database.catalog()).toEqual(catalogBefore);
    await request(server).post('/orders').send(purchase).expect(410).expect(res => expect(res.body.error.code).toBe('ORDER_CLEARED'));
    await request(server).post('/orders').send({ ...purchase, quantity: 2 }).expect(409);
    await request(server).get('/orders').expect(200).expect(res => expect(res.body.orders).toEqual([]));
    await request(server).post('/orders').send({ ...purchase, confirmationId: 'new-purchase-after-clear' }).expect(201);
  });

  it('keeps both collections cleared and confirmation guards intact after restart', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'needle-clear-')); folders.push(directory);
    const databaseFile = join(directory, 'needle.sqlite'); const first = app({ databaseFile });
    const selection = await find(first);
    const purchase = { ...selection, confirmationId: 'persist-clear-123', confirmed: true };
    await request(first).post('/orders').send(purchase).expect(201);
    await request(first).post('/cart').send(selection).expect(200);
    await request(first).post('/cart/clear').send({}).expect(200);
    await request(first).post('/orders/clear').send({}).expect(200);
    const second = app({ databaseFile });
    await request(second).get('/cart').expect(200).expect(res => expect(res.body.items).toEqual([]));
    await request(second).get('/orders').expect(200).expect(res => expect(res.body.orders).toEqual([]));
    await request(second).post('/orders').send(purchase).expect(410);
    await request(second).post('/cart/clear').send({}).expect(200);
    await request(second).post('/orders/clear').send({}).expect(200);
    await request(second).post('/refine').send({ sessionId: selection.sessionId, instruction: 'under KRW 100000' }).expect(200);
  });

  it('requires a strict empty JSON object and retains local-origin protection', async () => {
    const server = app(); const selection = await find(server);
    await request(server).post('/cart').send(selection).expect(200);
    await request(server).post('/orders').send({ ...selection, confirmationId: 'validation-keep-123', confirmed: true }).expect(201);
    for (const path of ['/cart/clear', '/orders/clear']) {
      await request(server).post(path).send({ all: true }).expect(400);
      await request(server).post(path).send([]).expect(400);
      await request(server).post(path).set('Content-Type', 'application/json').send('null').expect(400);
      await request(server).post(path).type('form').send({}).expect(415);
      await request(server).post(path).set('Origin', 'https://unrelated.example').send({}).expect(403);
      await request(server).post(path).set('Host', 'attacker.example').send({}).expect(403);
    }
    await request(server).get('/cart').expect(200).expect(res => expect(res.body.items).toHaveLength(1));
    await request(server).get('/orders').expect(200).expect(res => expect(res.body.orders).toHaveLength(1));
  });

  it('does not import legacy receipts again after history is cleared', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'needle-clear-legacy-')); folders.push(directory);
    const legacy = join(directory, 'orders.json'); const databaseFile = join(directory, 'needle.sqlite');
    const confirmationId = 'legacy-cleared-123';
    const original = JSON.stringify([[confirmationId, { fingerprint: 'old-fingerprint', order: { id: 'NDL-LEGACY', confirmationId, createdAt: new Date().toISOString(), status: 'simulated', title: 'Old receipt' } }]]);
    writeFileSync(legacy, original);
    const first = app({ databaseFile, orderFile: legacy });
    await request(first).get('/orders').expect(200).expect(res => expect(res.body.orders).toHaveLength(1));
    await request(first).post('/orders/clear').send({}).expect(200);
    const second = app({ databaseFile, orderFile: legacy });
    await request(second).get('/orders').expect(200).expect(res => expect(res.body.orders).toEqual([]));
    expect(readFileSync(legacy, 'utf8')).toBe(original);
  });
});
