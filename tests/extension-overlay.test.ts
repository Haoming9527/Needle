import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaCrop, sameGeometry, type MediaGeometry } from '../src/extension/capture/geometry';

const base: MediaGeometry = { x: 100, y: 40, width: 1000, height: 600, viewportWidth: 1200, viewportHeight: 800, pointerX: 900, pointerY: 300, scrollX: 0, scrollY: 0 };
describe('object crop geometry', () => {
  it('captures only a 320px region around the pointer', () => {
    expect(mediaCrop(base)).toEqual({ x: 740, y: 140, width: 320, height: 320, viewportWidth: 1200, viewportHeight: 800 });
  });
  it('clamps partially visible media to viewport and retains small images', () => {
    expect(mediaCrop({ ...base, x: -40, width: 300, height: 160, pointerX: 10, pointerY: 100 })).toMatchObject({ x: 0, y: 40, width: 260, height: 160 });
  });
  it('rejects nonfinite geometry and pointers outside the media', () => {
    expect(() => mediaCrop({ ...base, x: NaN })).toThrow();
    expect(() => mediaCrop({} as MediaGeometry)).toThrow();
    expect(() => mediaCrop({ ...base, pointerX: 1199 })).toThrow();
  });
  it('invalidates capture when media, scroll, or viewport changes', () => {
    expect(sameGeometry(base, { ...base })).toBe(true);
    expect(sameGeometry(base, { ...base, scrollY: 50 })).toBe(false);
    expect(sameGeometry(base, { ...base, viewportWidth: 1000 })).toBe(false);
    expect(sameGeometry({} as MediaGeometry, {} as MediaGeometry)).toBe(false);
    expect(sameGeometry(base, { ...base, width: Number.POSITIVE_INFINITY })).toBe(false);
  });
});

function event() {
  const listeners = new Set<(...args: any[]) => unknown>();
  return { addListener: vi.fn((fn: (...args: any[]) => unknown) => listeners.add(fn)), removeListener: vi.fn((fn: (...args: any[]) => unknown) => listeners.delete(fn)), emit: (...args: any[]) => [...listeners].forEach(fn => fn(...args)), listeners };
}
const tab = { id: 12, windowId: 1, url: 'https://x.com/example/status/123', title: 'X' };
const sender = { id: 'a'.repeat(32), tab, url: tab.url, frameId: 0 };
let api: any;
let saved: Record<string, any>;
let drawing: any;
const result = { sessionId: '11111111-1111-4111-8111-111111111111', mode: 'sample', interpretation: { name: 'Microphone' }, offers: [{ id: 'mic', title: 'Microphone', variants: ['Black'] }], warnings: [] };
function message(value: Record<string, unknown>, source: unknown = sender) {
  return new Promise<any>(resolve => api.runtime.onMessage.emit(value, source, resolve));
}
beforeEach(async () => {
  vi.resetModules(); saved = {};
  api = {
    runtime: { id: sender.id, onMessage: event() },
    sidePanel: { open: vi.fn(async () => {}) },
    storage: { local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) }, onChanged: event(), session: { set: vi.fn(async (v: Record<string, unknown>) => Object.assign(saved, v)), get: vi.fn(async (key: string) => ({ [key]: saved[key] })), remove: vi.fn(async (key: string) => { delete saved[key]; }) } },
    tabs: { query: vi.fn(async () => [tab]), captureVisibleTab: vi.fn(async () => 'data:image/jpeg;base64,AA=='), sendMessage: vi.fn(async () => ({ geometry: base, text: 'Shure microphone', context: 'Podcast recording' })), onActivated: event(), onUpdated: event() },
  };
  vi.stubGlobal('chrome', api);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 2400, height: 1600, close: vi.fn() })));
  drawing = { drawImage: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fillRect: vi.fn(), fillText: vi.fn() };
  vi.stubGlobal('OffscreenCanvas', class { encoded = 0; constructor(public width: number, public height: number) {} getContext() { return drawing; } async convertToBlob() { return new Blob([new Uint8Array(++this.encoded === 1 ? [1, 2, 3] : [4, 5, 6])], { type: 'image/jpeg' }); } });
  (await import('../src/extension/overlay-background')).installOverlayMessages();
});
afterEach(() => vi.unstubAllGlobals());

describe('automatic right-click workflow', () => {
  it('does not capture or upload while the persisted switch is off', async () => {
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: false } }, 'local');
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-off' });
    expect(response.error).toContain('Needle is off');
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('aborts a pending screenshot before upload when switched off', async () => {
    let finish!: () => void;
    api.tabs.captureVisibleTab.mockImplementation(() => new Promise<string>(resolve => { finish = () => resolve('data:image/jpeg;base64,AA=='); }));
    const discovery = message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-disable' });
    await vi.waitFor(() => expect(api.tabs.captureVisibleTab).toHaveBeenCalled());
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: false } }, 'local');
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: true } }, 'local');
    finish();
    expect((await discovery).error).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
  });
  it('aborts an already-running provider request and ignores its late response after OFF', async () => {
    let finish!: () => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(Response.json(result)); }));
    const discovery = message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-disable-fetch' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const signal = vi.mocked(fetch).mock.calls[0][1]!.signal!;
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: false } }, 'local');
    expect(signal.aborted).toBe(true);
    finish();
    expect((await discovery).error).toBeTruthy();
    expect(saved['needle.overlay.12']).toBeUndefined();
  });
  it('sends the exact off-center cursor point and a marked crop to vision', async () => {
    const edge = { ...base, pointerX: 105, pointerY: 45 };
    api.tabs.sendMessage.mockResolvedValue({ geometry: edge });
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-edge' });
    const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(request.selection.focus).toEqual({ x: 5 / 320, y: 5 / 320 });
    expect(request.selection.annotatedImageDataUrl).toBe('data:image/jpeg;base64,BAUG');
    expect(request.selection.imageDataUrl).toBe('data:image/jpeg;base64,AQID');
    expect(drawing.arc).toHaveBeenCalledWith(10, 10, 20, 0, Math.PI * 2);
    expect(drawing.fillText.mock.calls[0][0]).toBe('CURSOR • TARGET');
    expect(drawing.drawImage.mock.calls[0].slice(1)).toEqual([200, 80, 640, 640, 0, 0, 640, 640]);
  });
  it('accepts a gesture from an ordinary website, not only X', async () => {
    const website = { ...tab, url: 'https://example.com/products', title: 'A product page' };
    api.tabs.query.mockResolvedValue([website]);
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-website' }, { ...sender, tab: website, url: website.url });
    expect(response.result.sessionId).toBe(result.sessionId);
    const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(request.selection.pageUrl).toBe(website.url);
    expect(request.mode).toBe('sample');
  });
  it('answers a top-frame gesture after a same-origin SPA route change', async () => {
    const current = { ...tab, url: 'https://www.instagram.com/reels/product/', title: 'Instagram' };
    api.tabs.query.mockResolvedValue([current]);
    const respond = vi.fn();
    api.runtime.onMessage.emit({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-spa' },
      { ...sender, tab: current, url: 'https://www.instagram.com/' }, respond);
    await vi.waitFor(() => expect(respond).toHaveBeenCalled(), { timeout: 1000 });
    expect(respond.mock.calls[0][0].result.sessionId).toBe(result.sessionId);
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.selection.pageUrl).toBe(current.url);
  });
  it('uses the verified top-frame origin when Chrome omits the sender URL', async () => {
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-origin' },
      { ...sender, url: undefined, origin: 'https://x.com' });
    expect(response.result.sessionId).toBe(result.sessionId);
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
  });
  it('returns an explicit page error for mismatched origins without capturing', async () => {
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-foreign-origin' },
      { ...sender, url: 'https://x.com.unrelated.example/home' });
    expect(response.error).toContain('page changed');
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('answers malformed requests from its own top-frame script instead of dropping the reply', async () => {
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: '' });
    expect(response.error).toContain('selection is no longer valid');
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
  it('uploads only the locally cropped media and stores the discovered result', async () => {
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' });
    expect(response.result.sessionId).toBe(result.sessionId);
    const request = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(request.selection.imageDataUrl).toBe('data:image/jpeg;base64,AQID');
    expect(request.selection.text).toContain('untrusted context');
    expect(request.screenshotDataUrl).toBeUndefined();
    expect(saved['needle.overlay.12'].result).toEqual(result);
    expect(api.tabs.sendMessage.mock.calls[0][1].type).toBe('NEEDLE_PREPARE_CAPTURE');
  });
  it('replays the same completed discovery without recapturing a later video frame', async () => {
    const first = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-retry' });
    const retry = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-retry' });
    expect(retry).toEqual(first);
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('joins a discovery still running when its message channel is retried', async () => {
    let finish!: () => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(resolve => { finish = () => resolve(Response.json(result)); }));
    const first = message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-inflight' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const retry = message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-inflight' });
    finish();
    expect(await retry).toEqual(await first);
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects messages from frames, foreign extensions, and internal pages', () => {
    const respond = vi.fn();
    api.runtime.onMessage.emit({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' }, { ...sender, frameId: 1 }, respond);
    api.runtime.onMessage.emit({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' }, { ...sender, id: 'foreign' }, respond);
    api.runtime.onMessage.emit({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' }, { ...sender, url: 'chrome://settings' }, respond);
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('does not upload when the media shifts after capture', async () => {
    api.tabs.sendMessage.mockImplementation(async (_id: number, request: { type: string }) => ({ geometry: request.type === 'NEEDLE_VALIDATE_CAPTURE' ? { ...base, y: 200 } : base }));
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' });
    expect(response.error).toContain('object moved'); expect(fetch).not.toHaveBeenCalled();
  });
  it('cancels discovery before any image is uploaded', async () => {
    let finish!: () => void;
    api.tabs.captureVisibleTab.mockImplementation(() => new Promise<string>(resolve => { finish = () => resolve('data:image/jpeg;base64,AA=='); }));
    const discovery = message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' });
    await vi.waitFor(() => expect(api.tabs.captureVisibleTab).toHaveBeenCalled());
    await message({ type: 'NEEDLE_OVERLAY_CANCEL', requestId: 'selection-123' }); finish();
    expect((await discovery).error).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
  });
  it('discards a result cancelled while its cache write is in flight', async () => {
    let release!: () => void;
    api.storage.session.set.mockImplementation((value: Record<string, unknown>) => new Promise<void>(resolve => {
      release = () => { Object.assign(saved, value); resolve(); };
    }));
    const discovery = message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-cancel-write' });
    await vi.waitFor(() => expect(api.storage.session.set).toHaveBeenCalled());
    await message({ type: 'NEEDLE_OVERLAY_CANCEL', requestId: 'selection-cancel-write' });
    release();
    expect((await discovery).error).toContain('cancelled');
    await vi.waitFor(() => expect(saved['needle.overlay.12']).toBeUndefined());
  });
  it('does not let cancellation of an older popup erase the next result', async () => {
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-old' });
    let release!: () => void;
    const stale = saved['needle.overlay.12'];
    api.storage.session.get.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({ 'needle.overlay.12': stale }); }));
    await message({ type: 'NEEDLE_OVERLAY_CANCEL', requestId: 'selection-old' });
    await vi.waitFor(() => expect(api.storage.session.get).toHaveBeenCalled());
    const next = message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-new' });
    // Let the next capture try to complete while the older cancellation's read is delayed.
    await new Promise(resolve => setTimeout(resolve, 20));
    release();
    expect((await next).result).toEqual(result);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(saved['needle.overlay.12'].requestId).toBe('selection-new');
  });
  it('discards a capture even if the user switches away and back before it returns', async () => {
    api.tabs.captureVisibleTab.mockImplementation(async () => {
      api.tabs.onActivated.emit({ windowId: tab.windowId, tabId: 99 });
      api.tabs.onActivated.emit({ windowId: tab.windowId, tabId: tab.id });
      return 'data:image/jpeg;base64,AA==';
    });
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-race' });
    expect(response.error).toBeTruthy(); expect(fetch).not.toHaveBeenCalled();
  });
  it('gives a recovery message when a target disappears before capture preparation', async () => {
    api.tabs.sendMessage.mockResolvedValue(undefined);
    const response = await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-gone' });
    expect(response.error).toContain('Right-click it again');
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('opens Buy synchronously from the button gesture and hands off the same offer', async () => {
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' });
    const pending = message({ type: 'NEEDLE_OVERLAY_BUY', requestId: 'selection-123', offerId: 'mic', variant: 'Black' });
    expect(api.sidePanel.open).toHaveBeenCalledWith({ tabId: 12 });
    expect(await pending).toEqual({ ok: true });
    expect(saved['needle.selection']).toMatchObject({ intent: 'buy', offerId: 'mic', variant: 'Black', result });
  });
  it('adds only offers from the current search and never posts an order', async () => {
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-123' });
    const invalid = await message({ type: 'NEEDLE_OVERLAY_CART', requestId: 'selection-123', offerId: 'injected' });
    expect(invalid.error).toBeTruthy(); expect(fetch).toHaveBeenCalledTimes(1);
    const cart = { items: [{ id: 'cart-mic', sessionId: result.sessionId, offer: result.offers[0], variant: 'Black', quantity: 1, createdAt: '2026-10-25T00:00:00.000Z' }] };
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(cart));
    expect(await message({ type: 'NEEDLE_OVERLAY_CART', requestId: 'selection-123', offerId: 'mic', variant: 'Black' })).toEqual(cart);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('http://127.0.0.1:4318/cart');
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string).operationId).toMatch(/^cart-[a-f0-9]{64}$/);
  });
  it('keeps cart retry keys stable while allowing a different offer or variant in the popup', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, offers: [
      { ...result.offers[0], variants: ['Black', 'White'] }, { id: 'mic-other', title: 'Another microphone', variants: ['Black'] },
    ] }));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-cart-keys' });
    for (const [offerId, variant] of [['mic', 'Black'], ['mic', 'Black'], ['mic', 'White'], ['mic-other', 'Black']]) {
      await message({ type: 'NEEDLE_OVERLAY_CART', requestId: 'selection-cart-keys', offerId, variant });
    }
    const keys = vi.mocked(fetch).mock.calls.slice(1).map(([, init]) => JSON.parse(init!.body as string).operationId);
    expect(keys[0]).toBe(keys[1]);
    expect(new Set(keys)).toHaveLength(3);
  });
  it('does not send an old cart action if Needle is switched off then on while its key is prepared', async () => {
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-cart-off' });
    let finish!: () => void;
    const digest = vi.spyOn(crypto.subtle, 'digest').mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { finish = () => resolve(new ArrayBuffer(32)); }));
    try {
      const pending = message({ type: 'NEEDLE_OVERLAY_CART', requestId: 'selection-cart-off', offerId: 'mic', variant: 'Black' });
      await vi.waitFor(() => expect(digest).toHaveBeenCalled());
      api.storage.onChanged.emit({ 'needle.enabled': { newValue: false } }, 'local');
      api.storage.onChanged.emit({ 'needle.enabled': { newValue: true } }, 'local');
      finish();
      expect((await pending).error).toContain('cancelled');
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally { digest.mockRestore(); }
  });
  it.each([null, {}, { items: null }])('does not confirm a malformed cart response: %j', async payload => {
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-cart-invalid' });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(payload));
    const response = await message({ type: 'NEEDLE_OVERLAY_CART', requestId: 'selection-cart-invalid', offerId: 'mic', variant: 'Black' });
    expect(response.error).toContain('could not be confirmed');
  });
  it('answers a question with the original marked frame and buys from the new result', async () => {
    const question = { ...result, interpretation: { name: 'Object', needsClarification: true, clarification: 'The guitar or the shirt?' }, offers: [] };
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(question));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-answer' });
    const response = await message({ type: 'NEEDLE_OVERLAY_CLARIFY', requestId: 'selection-answer', answer: 'The black guitar on the left' });
    expect(response.result).toEqual(result);
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[1];
    const body = JSON.parse(init!.body as string);
    expect(url).toBe('http://127.0.0.1:4318/clarify');
    expect(body).toMatchObject({ sessionId: question.sessionId, answer: 'The black guitar on the left', selection: { annotatedImageDataUrl: 'data:image/jpeg;base64,BAUG', imageDataUrl: 'data:image/jpeg;base64,AQID', focus: { x: 0.5, y: 0.5 } } });
    await message({ type: 'NEEDLE_OVERLAY_BUY', requestId: 'selection-answer', offerId: 'mic' });
    expect(saved['needle.selection'].selection.clarifications).toEqual([{ question: 'The guitar or the shirt?', answer: 'The black guitar on the left' }]);
    expect(saved['needle.selection'].result).toEqual(result);
  });
  it('keeps a failed question available for retry without capturing another frame', async () => {
    const question = { ...result, interpretation: { needsClarification: true, clarification: 'Which item?' }, offers: [] };
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(question));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-retry' });
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    expect((await message({ type: 'NEEDLE_OVERLAY_CLARIFY', requestId: 'selection-retry', answer: 'Guitar' })).error).toBeTruthy();
    expect(saved['needle.overlay.12'].result).toEqual(question);
    expect((await message({ type: 'NEEDLE_OVERLAY_CLARIFY', requestId: 'selection-retry', answer: 'Guitar' })).result).toEqual(result);
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
  });
  it('continues an empty result with the original crop and accepts a voice answer', async () => {
    const empty = { ...result, interpretation: { name: 'Black microphone', productType: 'microphone', needsClarification: false, clarification: null }, offers: [] };
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(empty));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-empty' });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ text: 'A similar black microphone' }));
    expect(await message({ type: 'NEEDLE_OVERLAY_TRANSCRIBE', requestId: 'selection-empty', audioDataUrl: 'data:audio/webm;base64,AAAA' })).toEqual({ text: 'A similar black microphone' });
    const response = await message({ type: 'NEEDLE_OVERLAY_CLARIFY', requestId: 'selection-empty', answer: 'A similar black microphone' });
    expect(response.result).toEqual(result);
    expect(api.tabs.captureVisibleTab).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[2];
    expect(url).toBe('http://127.0.0.1:4318/clarify');
    expect(JSON.parse(init!.body as string)).toMatchObject({ sessionId: empty.sessionId, answer: 'A similar black microphone', selection: { annotatedImageDataUrl: 'data:image/jpeg;base64,BAUG', imageDataUrl: 'data:image/jpeg;base64,AQID', focus: { x: 0.5, y: 0.5 } } });
    expect(saved['needle.overlay.12'].captured.selection.clarifications[0].answer).toBe('A similar black microphone');
  });
  it('discards a clarification when the popup is cancelled', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, interpretation: { needsClarification: true, clarification: 'Which item?' }, offers: [] }));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-cancel-answer' });
    let release!: () => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(Response.json(result)); }));
    const pending = message({ type: 'NEEDLE_OVERLAY_CLARIFY', requestId: 'selection-cancel-answer', answer: 'Guitar' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await message({ type: 'NEEDLE_OVERLAY_CANCEL', requestId: 'selection-cancel-answer' });
    release();
    expect((await pending).error).toContain('cancelled');
    await vi.waitFor(() => expect(saved['needle.overlay.12']).toBeUndefined());
  });
  it('binds voice requests to the pending question and returns a transcript without submitting it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, interpretation: { needsClarification: true, clarification: 'Which item?' }, offers: [] }));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-voice' });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ audioDataUrl: 'data:audio/mpeg;base64,AAAA' }));
    await message({ type: 'NEEDLE_OVERLAY_SPEAK', requestId: 'selection-voice' });
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('http://127.0.0.1:4318/voice/question');
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)).toEqual({ sessionId: result.sessionId });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ text: 'The instrument' }));
    expect(await message({ type: 'NEEDLE_OVERLAY_TRANSCRIBE', requestId: 'selection-voice', audioDataUrl: 'data:audio/webm;base64,AAAA' })).toEqual({ text: 'The instrument' });
    expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual(['http://127.0.0.1:4318/discover', 'http://127.0.0.1:4318/voice/question', 'http://127.0.0.1:4318/voice/transcribe']);
    expect(JSON.stringify(saved)).not.toContain('data:audio');
    expect(saved['needle.overlay.12'].result.interpretation.needsClarification).toBe(true);
  });
  it('cancels speech without clearing the pending question and drops its late response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, interpretation: { needsClarification: true, clarification: 'Which item?' }, offers: [] }));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-voice-stop' });
    let release!: () => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(Response.json({ audioDataUrl: 'data:audio/mpeg;base64,AAAA' })); }));
    const pending = message({ type: 'NEEDLE_OVERLAY_SPEAK', requestId: 'selection-voice-stop' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const signal = vi.mocked(fetch).mock.calls[1][1]!.signal!;
    await message({ type: 'NEEDLE_OVERLAY_VOICE_CANCEL', requestId: 'selection-voice-stop' });
    expect(signal.aborted).toBe(true); release();
    expect((await pending).error).toContain('cancelled');
    expect(saved['needle.overlay.12'].result.interpretation.needsClarification).toBe(true);
  });
  it('aborts speech when switched off and never returns late audio after re-enabling', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...result, interpretation: { needsClarification: true, clarification: 'Which item?' }, offers: [] }));
    await message({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: 'selection-voice-off' });
    let release!: () => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(Response.json({ audioDataUrl: 'data:audio/mpeg;base64,AAAA' })); }));
    const pending = message({ type: 'NEEDLE_OVERLAY_SPEAK', requestId: 'selection-voice-off' });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const signal = vi.mocked(fetch).mock.calls[1][1]!.signal!;
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: false } }, 'local');
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: true } }, 'local');
    expect(signal.aborted).toBe(true); release();
    const response = await pending;
    expect(response.error).toBeTruthy(); expect(response.audioDataUrl).toBeUndefined();
  });
});
