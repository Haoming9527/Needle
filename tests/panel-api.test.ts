import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/panel/api';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('panel API recovery', () => {
  it('rejects a truncated success body instead of returning null to the UI', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"items":', { status: 200 })));
    await expect(apiRequest('/cart')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', retryable: true });
  });

  it('rejects null success responses instead of clearing a valid selection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(null)));
    await expect(apiRequest('/discover', { selection: { text: 'headphones' } })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('ignores a response that finishes reading after cancellation', async () => {
    const controller = new AbortController();
    let finish!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: () => new Promise(resolve => { finish = resolve; }) })));
    const result = apiRequest('/cart', undefined, controller.signal);
    const check = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    controller.abort(); finish({ items: [] });
    await check;
  });

  it('explains a timeout without exposing a raw browser exception', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new DOMException('signal timed out', 'TimeoutError'); }));
    const signal = AbortSignal.abort(new DOMException('signal timed out', 'TimeoutError'));
    await expect(apiRequest('/cart', undefined, signal)).rejects.toMatchObject({ code: 'TIMEOUT', retryable: true });
  });

  it('preserves actionable server failures and does not replay mutations', async () => {
    const fetch = vi.fn(async () => Response.json({ error: { code: 'SESSION_EXPIRED', message: 'Find the item again.', retryable: false } }, { status: 410 }));
    vi.stubGlobal('fetch', fetch);
    await expect(apiRequest('/cart', { offerId: 'old' })).rejects.toMatchObject({ code: 'SESSION_EXPIRED', message: 'Find the item again.', retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
