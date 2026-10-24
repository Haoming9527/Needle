import type { CapturedSelection, Selection } from '../../shared/types';
import { installOverlayMessages } from './overlay-background';

installOverlayMessages();

const MENU_ID = 'needle-find';
const KEY = 'needle.selection';
const SUPPORTED = /^https?:\/\//i;
let latestCapture = 0;

chrome.runtime.onInstalled.addListener(() => {
  void chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Find on Coupang with Needle',
      contexts: ['image', 'selection', 'page', 'link', 'video'],
      documentUrlPatterns: ['http://*/*', 'https://*/*'],
    });
  });
  // Manifest content scripts cover new documents. Reattach to open pages after an
  // extension update too, so a stale tab does not keep only the native menu.
  void installInOpenPages().catch(() => {});
});

async function installInOpenPages(): Promise<void> {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.allSettled(tabs.filter(tab => tab.id != null && !!tab.url && SUPPORTED.test(tab.url)).map(tab =>
    chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'], injectImmediately: true }),
  ));
}

// Register listeners synchronously so MV3 can wake this worker for user gestures.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id == null) return;
  const version = ++latestCapture;
  // Opening must happen in the original user-gesture callback, before an await.
  const open = chrome.sidePanel.open({ tabId: tab.id });
  void open.then(() => capture(tab, info)).then(value => version === latestCapture ? save(value) : undefined)
    .catch((error: unknown) => version === latestCapture ? saveFailure(tab, error) : undefined);
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  const version = ++latestCapture;
  const open = chrome.sidePanel.open({ tabId: tab.id });
  void open.then(() => capture(tab)).then(value => version === latestCapture ? save(value) : undefined)
    .catch((error: unknown) => version === latestCapture ? saveFailure(tab, error) : undefined);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'NEEDLE_CAPTURE' || sender.id !== chrome.runtime.id) return;
  const version = ++latestCapture;
  void chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([tab]) => {
    if (!tab) throw new Error('Open a webpage and invoke Needle from its right-click menu first.');
    const selection = await capture(tab);
    if (version !== latestCapture) throw new Error('A newer selection is already open. Continue with that selection.');
    await save(selection);
    return { selection };
  }).then(sendResponse).catch((error: unknown) => sendResponse({ error: captureError(error) }));
  return true;
});

async function save(selection: CapturedSelection): Promise<void> {
  await chrome.storage.session.set({ [KEY]: selection });
}

function captureError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/unsupported|chrome:|restricted|cannot access|permission|extensions gallery/i.test(message)) {
    return 'Needle can capture ordinary webpages. Open one, then right-click and choose “Find on Coupang with Needle” to grant access.';
  }
  return message || 'Could not capture this item. Right-click the webpage again, or describe the product in Needle.';
}

async function saveFailure(tab: chrome.tabs.Tab, error: unknown): Promise<void> {
  await save({ id: crypto.randomUUID(), selection: { pageUrl: tab.url, pageTitle: tab.title }, needsCrop: false, error: captureError(error) });
}

async function capture(tab: chrome.tabs.Tab, info?: chrome.contextMenus.OnClickData): Promise<CapturedSelection> {
  if (tab.id == null || !tab.url || !SUPPORTED.test(tab.url)) throw new Error('Unsupported browser page.');
  const selection: Selection = {
    text: info?.selectionText?.slice(0, 2000),
    pageUrl: tab.url,
    pageTitle: tab.title,
    capturedAt: new Date().toISOString(),
  };
  const result: CapturedSelection = { id: crypto.randomUUID(), selection, needsCrop: false };
  // A text selection needs no screenshot or additional page access.
  if (selection.text) return result;
  const imageUrl = info?.mediaType === 'image' ? info.srcUrl : undefined;
  let box: { x: number; y: number; width: number; height: number; viewportWidth: number; viewportHeight: number; text: string } | null = null;
  if (imageUrl && (!info?.frameId || info.frameId === 0)) {
    try {
      const [{ result: found }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (url: string) => {
          const images = Array.from(document.images).filter(img => img.currentSrc === url || img.src === url);
          const candidates = images.filter(img => {
            const r = img.getBoundingClientRect();
            return r.width > 8 && r.height > 8 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
          });
          if (candidates.length !== 1) return null;
          const img = candidates[0];
          const r = img.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, viewportWidth: innerWidth, viewportHeight: innerHeight, text: (img.alt || img.title || '').slice(0, 800) };
        },
        args: [imageUrl],
      });
      box = found ?? null;
    } catch { /* User can still crop the visible screenshot, including frames. */ }
  }
  // captureVisibleTab captures the active tab; never upload a different tab on a race.
  const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  if (active?.id !== tab.id) throw new Error('The active tab changed. Right-click the item again.');
  let changedDuringCapture = false;
  const onActivated = (activeInfo: { tabId: number; windowId: number }) => {
    if (activeInfo.windowId === tab.windowId && activeInfo.tabId !== tab.id) changedDuringCapture = true;
  };
  const onUpdated = (id: number, change: { url?: string; status?: string }) => {
    if (id === tab.id && (change.url || change.status === 'loading')) changedDuringCapture = true;
  };
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  let screenshot: string;
  try {
    screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 85 });
    const [after] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (changedDuringCapture || after?.id !== tab.id || after.url !== tab.url) {
      throw new Error('The page changed during capture. Right-click the item again.');
    }
  } finally {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  }
  if (box) {
    // Decode locally; fetching data URLs would require broadening connect-src.
    const imageBytes = Uint8Array.from(atob(screenshot.split(',')[1]), character => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([imageBytes], { type: 'image/jpeg' }));
    const scaleX = bitmap.width / box.viewportWidth;
    const scaleY = bitmap.height / box.viewportHeight;
    const width = Math.max(1, Math.round(box.width * scaleX));
    const height = Math.max(1, Math.round(box.height * scaleY));
    const reduction = Math.min(1, 1600 / Math.max(width, height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * reduction)), Math.max(1, Math.round(height * reduction)));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image capture is unavailable. Describe the item instead.');
    context.drawImage(bitmap, box.x * scaleX, box.y * scaleY, width, height, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    selection.imageDataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
    selection.text = box.text || undefined;
  } else {
    result.screenshotDataUrl = screenshot;
    result.needsCrop = true;
  }
  // Full-page screenshot stays in session storage for the crop UI, never the backend.
  return result;
}
