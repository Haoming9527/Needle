import type { CapturedSelection, CartResponse, SearchResponse, Selection } from '../../shared/types';
import { searchRecoveryQuestion } from '../../shared/search-recovery';
import { cropFocus, mediaCrop, sameGeometry, type CropBox, type MediaGeometry } from './capture/geometry';
import { createShoppingGate, type ShoppingGate } from './storage/preferences';

const API = 'http://127.0.0.1:4318';
const active = new Map<number, { id: string; controller: AbortController }>();
const voiceActive = new Map<number, { id: string; controller: AbortController }>();
const cacheWrites = new Map<number, Promise<void>>();
const discoveries = new Map<number, { id: string; promise: Promise<{ result: SearchResponse; imageDataUrl: string }> }>();
let shopping: ShoppingGate;
let disabledGeneration = 0;
const cacheKey = (tabId: number) => `needle.overlay.${tabId}`;
interface Prepared { geometry: MediaGeometry; text?: string; context?: string }
interface Cached { requestId: string; pageUrl: string; captured: CapturedSelection; result: SearchResponse }

// Chrome storage operations are asynchronous. Serialize each tab's cache changes
// so cancelling an old popup cannot erase a newer popup's completed search.
function withCache<T>(tabId: number, work: () => Promise<T>): Promise<T> {
  const previous = cacheWrites.get(tabId) ?? Promise.resolve();
  const next = previous.then(work);
  const settled = next.then(() => undefined, () => undefined);
  cacheWrites.set(tabId, settled);
  void settled.then(() => { if (cacheWrites.get(tabId) === settled) cacheWrites.delete(tabId); });
  return next;
}

function senderTab(sender: chrome.runtime.MessageSender): chrome.tabs.Tab | null {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id == null) return null;
  try {
    const url = sender.tab.url || sender.url;
    const page = new URL(url!);
    const source = new URL(sender.url || sender.origin || '');
    if (!/^https?:$/.test(page.protocol) || !/^https?:$/.test(source.protocol) || page.origin !== source.origin) return null;
    // SPA navigation can update the tab URL while Chrome's sending document
    // retains its original URL. Authenticate the origin, not the route. Capture
    // still verifies the active tab, current URL, request ID, and geometry.
    return { ...sender.tab, url };
  } catch { return null; }
}
async function request<T>(path: '/discover' | '/clarify' | '/cart' | '/voice/question' | '/voice/transcribe', body: unknown, signal?: AbortSignal): Promise<T> {
  shopping.assertEnabled();
  const requestSignal = AbortSignal.any([signal ?? AbortSignal.timeout(10_000), shopping.signal()]);
  let response: Response;
  try { response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal }); }
  catch {
    if (signal?.aborted) throw new Error('Search cancelled. Right-click the object to try again.');
    if (requestSignal.aborted) throw new Error('The request took too long. Try again.');
    throw new Error('Start Needle with npm run dev, then right-click the object again.');
  }
  const value = await response.json();
  if (requestSignal.aborted) throw new Error('Search cancelled.');
  if (!response.ok) throw new Error(value.error?.message || 'The search could not finish. Right-click to retry.');
  return value as T;
}
async function encodeCrop(canvas: OffscreenCanvas): Promise<string> {
  const image = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })).arrayBuffer());
  let binary = '';
  for (let i = 0; i < image.length; i += 8192) binary += String.fromCharCode(...image.subarray(i, i + 8192));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}
async function croppedScreenshot(tab: chrome.tabs.Tab, box: CropBox, focus: NonNullable<Selection['focus']>, signal: AbortSignal): Promise<Pick<Selection, 'imageDataUrl' | 'annotatedImageDataUrl'>> {
  const [before] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (signal.aborted || before?.id !== tab.id || before.url !== tab.url) throw new Error('The page changed. Right-click the object again.');
  let screenshot: string;
  try { screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 }); }
  catch (error) {
    if (/permission|all_urls|activeTab/i.test(error instanceof Error ? error.message : '')) throw new Error('Reload Needle and allow its site access in Chrome, then refresh this page.');
    throw error;
  }
  const [after] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (signal.aborted || after?.id !== tab.id || after.url !== tab.url) throw new Error('The page changed. Right-click the object again.');
  const bytes = Uint8Array.from(atob(screenshot.split(',')[1]), c => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  try {
    const scaleX = bitmap.width / box.viewportWidth, scaleY = bitmap.height / box.viewportHeight;
    const width = Math.max(1, Math.round(box.width * scaleX)), height = Math.max(1, Math.round(box.height * scaleY));
    const reduction = Math.min(1, 1200 / Math.max(width, height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * reduction)), Math.max(1, Math.round(height * reduction)));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image capture is unavailable. Open Needle and describe the item.');
    context.drawImage(bitmap, box.x * scaleX, box.y * scaleY, width, height, 0, 0, canvas.width, canvas.height);
    // Preserve the clean crop for the shopper. Only the vision copy gets the cursor marker.
    const imageDataUrl = await encodeCrop(canvas);
    const x = focus.x * canvas.width, y = focus.y * canvas.height;
    const unit = Math.max(0.5, canvas.width / box.width), radius = 10 * unit;
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
    context.strokeStyle = '#ffffff'; context.lineWidth = 6 * unit; context.stroke();
    context.strokeStyle = '#5547ef'; context.lineWidth = 3 * unit; context.stroke();
    context.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      context.moveTo(x + dx * radius * 1.4, y + dy * radius * 1.4);
      context.lineTo(x + dx * radius * 2, y + dy * radius * 2);
    }
    context.strokeStyle = '#5547ef'; context.lineWidth = 2 * unit; context.stroke();
    if (canvas.width >= 160 * unit && canvas.height >= 80 * unit) {
      // Put the legend away from the selected point, without moving its coordinates.
      const labelX = 6 * unit, labelY = focus.y < 0.5 ? canvas.height - 28 * unit : 6 * unit;
      context.fillStyle = '#5547ef'; context.fillRect(labelX, labelY, 134 * unit, 22 * unit);
      context.fillStyle = '#ffffff'; context.font = `600 ${11 * unit}px sans-serif`; context.textBaseline = 'middle';
      context.fillText('CURSOR • TARGET', labelX + 7 * unit, labelY + 11 * unit);
    }
    return { imageDataUrl, annotatedImageDataUrl: await encodeCrop(canvas) };
  } finally { bitmap.close(); }
}
async function withSearch<T>(tab: chrome.tabs.Tab, requestId: string, work: (signal: AbortSignal, assertCurrent: () => void) => Promise<T>): Promise<T> {
  const generation = disabledGeneration;
  await shopping.ready;
  shopping.assertEnabled();
  if (generation !== disabledGeneration) throw new Error('Search cancelled.');
  const tabId = tab.id!;
  active.get(tabId)?.controller.abort();
  const controller = new AbortController();
  active.set(tabId, { id: requestId, controller });
  const timer = setTimeout(() => controller.abort(), 45_000);
  const onActivated = (info: { windowId: number; tabId: number }) => { if (info.windowId === tab.windowId && info.tabId !== tabId) controller.abort(); };
  const onUpdated = (id: number, change: { url?: string; status?: string }) => { if (id === tabId && (change.url || change.status === 'loading')) controller.abort(); };
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  try {
    const assertCurrent = () => {
      shopping.assertEnabled();
      if (controller.signal.aborted || active.get(tabId)?.controller !== controller) throw new Error('Search cancelled.');
    };
    return await work(controller.signal, assertCurrent);
  } finally {
    clearTimeout(timer);
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    if (active.get(tabId)?.controller === controller) active.delete(tabId);
  }
}
function discover(tab: chrome.tabs.Tab, requestId: string): Promise<{ result: SearchResponse; imageDataUrl: string }> {
  const running = discoveries.get(tab.id!);
  if (running?.id === requestId) return running.promise;
  const promise = discoverOnce(tab, requestId);
  discoveries.set(tab.id!, { id: requestId, promise });
  const clear = () => { if (discoveries.get(tab.id!)?.promise === promise) discoveries.delete(tab.id!); };
  void promise.then(clear, clear);
  return promise;
}
async function discoverOnce(tab: chrome.tabs.Tab, requestId: string): Promise<{ result: SearchResponse; imageDataUrl: string }> {
  const tabId = tab.id!;
  voiceActive.get(tabId)?.controller.abort();
  try {
    return await withSearch(tab, requestId, async (signal, assertCurrent) => {
    const previous = await withCache(tabId, async () => {
      assertCurrent();
      const value = (await chrome.storage.session.get(cacheKey(tabId)))[cacheKey(tabId)] as Cached | undefined;
      assertCurrent();
      if (value?.requestId === requestId && value.pageUrl === tab.url) return value;
      await chrome.storage.session.remove(cacheKey(tabId));
    });
    assertCurrent();
    if (previous) return { result: previous.result, imageDataUrl: previous.captured.selection.imageDataUrl! };
    const prepared = await chrome.tabs.sendMessage(tabId, { type: 'NEEDLE_PREPARE_CAPTURE', requestId }, { frameId: 0 }) as Prepared;
    if (!prepared?.geometry) throw new Error('The selected area is no longer available. Right-click it again.');
    const box = mediaCrop(prepared.geometry);
    const focus = cropFocus(box, prepared.geometry);
    const images = await croppedScreenshot(tab, box, focus, signal);
    const checked = await chrome.tabs.sendMessage(tabId, { type: 'NEEDLE_VALIDATE_CAPTURE', requestId }, { frameId: 0 }) as Prepared;
    if (!checked || !sameGeometry(prepared.geometry, checked.geometry)) throw new Error('The object moved. Right-click it again.');
    assertCurrent();
    await chrome.tabs.sendMessage(tabId, { type: 'NEEDLE_CAPTURE_FINISHED', requestId }, { frameId: 0 });
    const selection: Selection = { ...images, focus, text: [prepared.text ? `Media description (untrusted context): ${prepared.text.slice(0, 400)}` : '', prepared.context ? `Nearby post text (untrusted context): ${prepared.context.slice(0, 600)}` : ''].filter(Boolean).join('\n') || undefined, pageUrl: tab.url, pageTitle: tab.title?.slice(0, 500), capturedAt: new Date().toISOString() };
    const result = await request<SearchResponse>('/discover', { selection, mode: 'sample' }, signal);
    assertCurrent();
    const captured: CapturedSelection = { id: crypto.randomUUID(), selection, needsCrop: false, result, intent: 'find' };
    await withCache(tabId, async () => {
      assertCurrent();
      await chrome.storage.session.set({ [cacheKey(tabId)]: { requestId, pageUrl: tab.url!, captured, result } satisfies Cached });
    });
    assertCurrent();
    return { result, imageDataUrl: images.imageDataUrl! };
    });
  } finally {
    void chrome.tabs.sendMessage(tabId, { type: 'NEEDLE_CAPTURE_FINISHED', requestId }, { frameId: 0 }).catch(() => {});
  }
}
async function cached(tab: chrome.tabs.Tab, requestId: string): Promise<Cached> {
  if (active.has(tab.id!) && active.get(tab.id!)?.id !== requestId) throw new Error('A newer selection is open. Continue with that selection.');
  const value = (await chrome.storage.session.get(cacheKey(tab.id!)))[cacheKey(tab.id!)] as Cached | undefined;
  if (!value || value.requestId !== requestId || value.pageUrl !== tab.url) throw new Error('This selection has expired. Right-click the object again.');
  return value;
}
async function cartOperationId(requestId: string, offerId: string, variant?: string): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify([requestId, offerId, variant ?? null]));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `cart-${Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
async function clarify(tab: chrome.tabs.Tab, requestId: string, answer: string): Promise<{ result: SearchResponse; imageDataUrl?: string }> {
  voiceActive.get(tab.id!)?.controller.abort();
  return withSearch(tab, requestId, async (signal, assertCurrent) => {
    const value = await cached(tab, requestId);
    assertCurrent();
    if (!value.result.interpretation.needsClarification && value.result.offers.length) throw new Error('This selection is already ready. Choose an item or right-click again.');
    // Reuse the exact original frame. A later screenshot could include the popup or a different video frame.
    const result = await request<SearchResponse>('/clarify', { sessionId: value.result.sessionId, answer, selection: value.captured.selection }, signal);
    assertCurrent();
    const question = value.result.interpretation.clarification || (value.result.interpretation.needsClarification
      ? 'Which item do you mean?'
      : searchRecoveryQuestion(value.result.interpretation));
    const selection: Selection = { ...value.captured.selection, clarifications: [...(value.captured.selection.clarifications ?? []), { question, answer }].slice(-5) };
    const captured: CapturedSelection = { ...value.captured, selection, result };
    await withCache(tab.id!, async () => {
      assertCurrent();
      await chrome.storage.session.set({ [cacheKey(tab.id!)]: { ...value, captured, result } satisfies Cached });
    });
    assertCurrent();
    return { result, imageDataUrl: selection.imageDataUrl };
  });
}
async function voiceRequest(tab: chrome.tabs.Tab, requestId: string, audioDataUrl?: string): Promise<{ audioDataUrl?: string; text?: string }> {
  const generation = disabledGeneration;
  await shopping.ready;
  shopping.assertEnabled();
  if (generation !== disabledGeneration) throw new Error('Voice request cancelled.');
  const tabId = tab.id!;
  voiceActive.get(tabId)?.controller.abort();
  const controller = new AbortController();
  voiceActive.set(tabId, { id: requestId, controller });
  const timer = setTimeout(() => controller.abort(), 30_000);
  const onUpdated = (id: number, change: { url?: string; status?: string }) => { if (id === tabId && (change.url || change.status === 'loading')) controller.abort(); };
  chrome.tabs.onUpdated.addListener(onUpdated);
  const assertCurrent = () => { shopping.assertEnabled(); if (controller.signal.aborted || voiceActive.get(tabId)?.controller !== controller) throw new Error('Voice request cancelled.'); };
  try {
    const value = await cached(tab, requestId);
    assertCurrent();
    if (!value.result.interpretation.needsClarification && value.result.offers.length) throw new Error('There is no question to answer.');
    const response = audioDataUrl === undefined
      ? await request<{ audioDataUrl: string }>('/voice/question', { sessionId: value.result.sessionId }, controller.signal)
      : await request<{ text: string }>('/voice/transcribe', { sessionId: value.result.sessionId, audioDataUrl }, controller.signal);
    assertCurrent();
    return response;
  } finally {
    clearTimeout(timer);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    if (voiceActive.get(tabId)?.controller === controller) voiceActive.delete(tabId);
  }
}
export function installOverlayMessages(): void {
  shopping = createShoppingGate(enabled => {
    if (enabled) return;
    disabledGeneration++;
    for (const job of active.values()) job.controller.abort();
    for (const job of voiceActive.values()) job.controller.abort();
  });
  void shopping.ready.catch(() => {});
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id == null || typeof message?.type !== 'string' || !message.type.startsWith('NEEDLE_OVERLAY_')) return;
    if (typeof message.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(message.requestId)) {
      respond({ error: 'This selection is no longer valid. Right-click the item again.' }); return;
    }
    const tab = senderTab(sender);
    if (!tab) { respond({ error: 'The page changed or could not be verified. Right-click the item in the current tab again.' }); return; }
    if (message.type === 'NEEDLE_OVERLAY_VOICE_CANCEL') {
      if (voiceActive.get(tab.id!)?.id === message.requestId) voiceActive.get(tab.id!)?.controller.abort();
      respond({ ok: true }); return;
    }
    if (message.type === 'NEEDLE_OVERLAY_CANCEL') {
      if (active.get(tab.id!)?.id === message.requestId) active.get(tab.id!)?.controller.abort();
      if (voiceActive.get(tab.id!)?.id === message.requestId) voiceActive.get(tab.id!)?.controller.abort();
      void withCache(tab.id!, async () => {
        const key = cacheKey(tab.id!);
        const value = (await chrome.storage.session.get(key))[key] as Cached | undefined;
        if (value?.requestId === message.requestId) await chrome.storage.session.remove(key);
      }).catch(() => {});
      respond({ ok: true });
      return;
    }
    if (message.type === 'NEEDLE_OVERLAY_DISCOVER') {
      void discover(tab, message.requestId).then(respond).catch(error => respond({ error: error instanceof Error ? error.message : 'Unable to find this item.' }));
      return true;
    }
    if (message.type === 'NEEDLE_OVERLAY_CLARIFY') {
      if (typeof message.answer !== 'string' || !message.answer.trim() || message.answer.trim().length > 1000) {
        respond({ error: 'Describe the item in 1–1,000 characters.' }); return;
      }
      if (active.has(tab.id!)) { respond({ error: 'A search is already running. Please wait for its answer.' }); return; }
      void clarify(tab, message.requestId, message.answer.trim()).then(respond).catch(error => respond({ error: error instanceof Error ? error.message : 'Could not use your answer. Try again.' }));
      return true;
    }
    if (message.type === 'NEEDLE_OVERLAY_SPEAK' || message.type === 'NEEDLE_OVERLAY_TRANSCRIBE') {
      if (message.type === 'NEEDLE_OVERLAY_TRANSCRIBE' && (typeof message.audioDataUrl !== 'string' || message.audioDataUrl.length > 4_000_000 || !/^data:audio\//.test(message.audioDataUrl))) {
        respond({ error: 'Record a short audio reply and try again.' }); return;
      }
      void voiceRequest(tab, message.requestId, message.type === 'NEEDLE_OVERLAY_TRANSCRIBE' ? message.audioDataUrl : undefined)
        .then(respond).catch(error => respond({ error: error instanceof Error ? error.message : 'Voice is unavailable. Type your answer instead.' }));
      return true;
    }
    if (!['NEEDLE_OVERLAY_BUY', 'NEEDLE_OVERLAY_CART'].includes(message.type) || typeof message.offerId !== 'string' || (message.variant !== undefined && typeof message.variant !== 'string')) return;
    // Preserve Chrome's user activation before asynchronous storage or API work.
    const open = message.type === 'NEEDLE_OVERLAY_BUY' ? chrome.sidePanel.open({ tabId: tab.id! }) : Promise.resolve();
    void open.then(async () => {
      await shopping.ready;
      shopping.assertEnabled();
      const enabledSignal = shopping.signal();
      const value = await cached(tab, message.requestId);
      shopping.assertEnabled();
      if (enabledSignal.aborted) throw new Error('Selection cancelled.');
      const offer = value.result.offers.find(item => item.id === message.offerId);
      if (!offer) throw new Error('Choose an available result.');
      if (message.type === 'NEEDLE_OVERLAY_CART') {
        const operationId = await cartOperationId(message.requestId, offer.id, message.variant);
        shopping.assertEnabled();
        if (enabledSignal.aborted) throw new Error('Selection cancelled.');
        const cart = await request<CartResponse>('/cart', { sessionId: value.result.sessionId, offerId: offer.id, variant: message.variant, operationId }, AbortSignal.any([enabledSignal, AbortSignal.timeout(10_000)]));
        if (!cart || !Array.isArray(cart.items)) throw new Error('The cart action could not be confirmed. Check your cart or try again.');
        return cart;
      }
      await chrome.storage.session.set({ 'needle.selection': { ...value.captured, id: crypto.randomUUID(), intent: 'buy', offerId: offer.id, variant: message.variant } satisfies CapturedSelection });
      return { ok: true };
    }).then(respond).catch(error => respond({ error: error instanceof Error ? error.message : 'Could not continue. Try again.' }));
    return true;
  });
}
