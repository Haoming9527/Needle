import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let values: Record<string, unknown>;
let changed: Set<(...args: any[]) => void>;
let api: any;
beforeEach(() => {
  vi.resetModules(); values = {}; changed = new Set();
  api = { runtime: { id: 'a'.repeat(32) }, storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: values[key] })),
      set: vi.fn(async (next: Record<string, unknown>) => {
        const changes = Object.fromEntries(Object.entries(next).map(([key, newValue]) => [key, { oldValue: values[key], newValue }]));
        Object.assign(values, next); changed.forEach(listener => listener(changes, 'local'));
      }),
    },
    onChanged: { addListener: (listener: (...args: any[]) => void) => changed.add(listener), removeListener: (listener: (...args: any[]) => void) => changed.delete(listener) },
  } };
  vi.stubGlobal('chrome', api);
});
afterEach(() => vi.unstubAllGlobals());

describe('persistent shopping preference', () => {
  it('defaults to enabled and persists OFF for a fresh client context', async () => {
    const client = await import('../src/extension/transport/client');
    expect(await client.getShoppingEnabled()).toBe(true);
    const listener = vi.fn(), unsubscribe = client.subscribeToShoppingEnabled(listener);
    await client.setShoppingEnabled(false);
    expect(values['needle.enabled']).toBe(false); expect(listener).toHaveBeenLastCalledWith(false);
    unsubscribe(); vi.resetModules();
    expect(await (await import('../src/extension/transport/client')).getShoppingEnabled()).toBe(false);
  });
  it('loads fail-closed and never lets a stale initial read override a newer OFF event', async () => {
    let finish!: (value: unknown) => void;
    api.storage.local.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { createShoppingGate, setShoppingEnabled } = await import('../src/extension/storage/preferences');
    const gate = createShoppingGate();
    expect(gate.isEnabled()).toBe(false);
    await setShoppingEnabled(false); finish({ 'needle.enabled': true });
    expect(await gate.ready).toBe(false); expect(gate.isEnabled()).toBe(false);
    gate.dispose();
  });
  it('aborts old work on OFF even when subsequently switched ON again', async () => {
    const { createShoppingGate, setShoppingEnabled } = await import('../src/extension/storage/preferences');
    const gate = createShoppingGate(); await gate.ready;
    const previous = gate.signal();
    await setShoppingEnabled(false); expect(previous.aborted).toBe(true);
    await setShoppingEnabled(true); expect(gate.isEnabled()).toBe(true);
    expect(gate.signal().aborted).toBe(false); expect(gate.signal()).not.toBe(previous);
    gate.dispose();
  });
  it('supports same-document and cross-tab localStorage updates in the web preview', async () => {
    vi.stubGlobal('chrome', undefined);
    const local = new Map<string, string>();
    const storage = { getItem: (key: string) => local.get(key) ?? null, setItem: (key: string, value: string) => local.set(key, value) };
    const target = new EventTarget(); vi.stubGlobal('window', target); vi.stubGlobal('localStorage', storage);
    const client = await import('../src/extension/transport/client');
    const listener = vi.fn(), unsubscribe = client.subscribeToShoppingEnabled(listener);
    await client.setShoppingEnabled(false);
    expect(await client.getShoppingEnabled()).toBe(false); expect(listener).toHaveBeenLastCalledWith(false);
    const event = new Event('storage'); Object.defineProperties(event, { storageArea: { value: storage }, key: { value: 'needle.enabled' }, newValue: { value: 'true' } });
    target.dispatchEvent(event); expect(listener).toHaveBeenLastCalledWith(true);
    unsubscribe();
  });
});
