import type { CapturedSelection, SearchResponse, Selection } from '../../shared/types';
import { cropFocus, mediaCrop, sameGeometry, type CropBox, type MediaGeometry } from './geometry';
import { contextTags } from '../../shared/context';

const API = 'http://127.0.0.1:4318';
const active = new Map<number, { id: string; controller: AbortController }>();
const cacheWrites = new Map<number, Promise<void>>();
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
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || sender.tab?.id == null || !sender.url || !/^https?:\/\//.test(sender.url)) return null;
  if (sender.tab.url !== sender.url) return null;
  return sender.tab;
}
async function request<T>(path: '/discover' | '/clarify' | '/cart' | '/saved-items', body: unknown, signal?: AbortSignal): Promise<T> {
  const requestSignal = signal ?? AbortSignal.timeout(10_000);
  let response: Response;
  try { response = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal }); }
  catch {
    if (signal?.aborted) throw new Error('Search cancelled. Right-click the object to try again.');
    if (requestSignal.aborted) throw new Error('The request took too long. Try again.');
    throw new Error('Start Needle with npm run dev, then right-click the object again.');
  }
  const value = await response.json();
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
async function discover(tab: chrome.tabs.Tab, requestId: string): Promise<{ result: SearchResponse; imageDataUrl: string }> {
  const tabId = tab.id!;
  try {
    return await withSearch(tab, requestId, async (signal, assertCurrent) => {
    await withCache(tabId, async () => {
      assertCurrent();
      await chrome.storage.session.remove(cacheKey(tabId));
    });
    assertCurrent();
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
async function clarify(tab: chrome.tabs.Tab, requestId: string, answer: string): Promise<{ result: SearchResponse; imageDataUrl?: string }> {
  return withSearch(tab, requestId, async (signal, assertCurrent) => {
    const value = await cached(tab, requestId);
    assertCurrent();
    if (!value.result.interpretation.needsClarification) throw new Error('This selection is already ready. Choose an item or right-click again.');
    // Reuse the exact original frame. A later screenshot could include the popup or a different video frame.
    const result = await request<SearchResponse>('/clarify', { sessionId: value.result.sessionId, answer, selection: value.captured.selection }, signal);
    assertCurrent();
    const selection: Selection = { ...value.captured.selection, clarifications: [...(value.captured.selection.clarifications ?? []), { question: value.result.interpretation.clarification ?? 'Which item do you mean?', answer }].slice(-5) };
    const captured: CapturedSelection = { ...value.captured, selection, result };
    await withCache(tab.id!, async () => {
      assertCurrent();
      await chrome.storage.session.set({ [cacheKey(tab.id!)]: { ...value, captured, result } satisfies Cached });
    });
    assertCurrent();
    return { result, imageDataUrl: selection.imageDataUrl };
  });
}
export function installOverlayMessages(): void {
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    const tab = senderTab(sender);
    if (!tab || !message || typeof message.requestId !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(message.requestId)) return;
    if (message.type === 'NEEDLE_OVERLAY_CANCEL') {
      if (active.get(tab.id!)?.id === message.requestId) active.get(tab.id!)?.controller.abort();
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
    if (message.type === 'NEEDLE_OVERLAY_SAVE') {
      // Save selected semantic context without taking a screenshot or requiring a product match.
      void chrome.tabs.sendMessage(tab.id!, { type: 'NEEDLE_READ_CONTEXT', requestId: message.requestId }, { frameId: 0 }).then(async context => {
        const [current] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
        if (current?.id !== tab.id || current.url !== tab.url) throw new Error('The page changed. Select the idea again.');
        const summary = [context?.text, context?.context].filter(value => typeof value === 'string').join(' · ').slice(0, 800) || tab.title?.slice(0, 300) || 'Saved inspiration';
        return request('/saved-items', { id: message.requestId, label: (context?.text || tab.title || 'Saved inspiration').slice(0, 160), summary, sourceOrigin: new URL(tab.url!).origin, sourceTitle: tab.title?.slice(0, 200), tags: contextTags(summary), provenance: 'observed' });
      }).then(() => respond({ ok: true })).catch(error => respond({ error: error instanceof Error ? error.message : 'Could not save inspiration.' }));
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
    if (!['NEEDLE_OVERLAY_BUY', 'NEEDLE_OVERLAY_CART'].includes(message.type) || typeof message.offerId !== 'string' || (message.variant !== undefined && typeof message.variant !== 'string')) return;
    // Preserve Chrome's user activation before asynchronous storage or API work.
    const open = message.type === 'NEEDLE_OVERLAY_BUY' ? chrome.sidePanel.open({ tabId: tab.id! }) : Promise.resolve();
    void open.then(async () => {
      const value = await cached(tab, message.requestId);
      const offer = value.result.offers.find(item => item.id === message.offerId);
      if (!offer) throw new Error('Choose an available result.');
      if (message.type === 'NEEDLE_OVERLAY_CART') return request('/cart', { sessionId: value.result.sessionId, offerId: offer.id, variant: message.variant });
      await chrome.storage.session.set({ 'needle.selection': { ...value.captured, id: crypto.randomUUID(), intent: 'buy', offerId: offer.id, variant: message.variant } satisfies CapturedSelection });
      return { ok: true };
    }).then(respond).catch(error => respond({ error: error instanceof Error ? error.message : 'Could not continue. Try again.' }));
    return true;
  });
}
