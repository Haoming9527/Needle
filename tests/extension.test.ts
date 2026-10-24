import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapturedSelection } from '../shared/types';

function event() {
  const listeners = new Set<(...args: any[]) => unknown>();
  return { addListener: vi.fn((fn: (...args: any[]) => unknown) => listeners.add(fn)), removeListener: vi.fn((fn: (...args: any[]) => unknown) => listeners.delete(fn)), emit: (...args: any[]) => [...listeners].forEach(fn => fn(...args)), listeners };
}
let api: any;
const tab = { id: 12, windowId: 1, url: 'https://example.com/inspiration', title: 'Inspiration' };
let values: Record<string, CapturedSelection>;
async function saved() { await vi.waitFor(() => expect(values['needle.selection']).toBeDefined()); return values['needle.selection']; }

beforeEach(async () => {
  vi.resetModules();
  values = {};
  api = {
    runtime: { id: 'a'.repeat(32), onInstalled: event(), onStartup: event(), onMessage: event() },
    contextMenus: { onClicked: event(), removeAll: vi.fn(async () => {}), create: vi.fn(), update: vi.fn(async () => {}) },
    action: { onClicked: event() },
    sidePanel: { open: vi.fn(async () => {}) },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) }, onChanged: event(),
      session: { set: vi.fn(async (value: Record<string, CapturedSelection>) => Object.assign(values, value)), remove: vi.fn(async (key: string) => { delete values[key]; }) },
    },
    scripting: { executeScript: vi.fn(async () => [{ result: null }]) },
    tabs: { query: vi.fn(async () => [tab]), captureVisibleTab: vi.fn(async () => 'data:image/jpeg;base64,AA=='), onActivated: event(), onUpdated: event() },
  };
  vi.stubGlobal('chrome', api);
  await import('../src/extension/background');
});
afterEach(() => vi.unstubAllGlobals());

describe('extension context capture', () => {
  it('keeps the toolbar available without capturing when shopping is off', async () => {
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: false } }, 'local');
    api.action.onClicked.emit(tab);
    expect(api.sidePanel.open).toHaveBeenCalledWith({ tabId: tab.id });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled();
    expect(api.storage.session.set).not.toHaveBeenCalled();
    expect(api.contextMenus.update).toHaveBeenCalledWith('needle-find', { enabled: false });
  });
  it('drops a pending native capture if shopping is switched off and back on', async () => {
    let finish!: (value: string) => void;
    api.tabs.captureVisibleTab.mockImplementation(() => new Promise<string>(resolve => { finish = resolve; }));
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find' }, tab);
    await vi.waitFor(() => expect(api.tabs.captureVisibleTab).toHaveBeenCalled());
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: false } }, 'local');
    api.storage.onChanged.emit({ 'needle.enabled': { newValue: true } }, 'local');
    finish('data:image/jpeg;base64,AA==');
    await vi.waitFor(() => expect(api.tabs.onActivated.listeners.size).toBe(0));
    expect(api.storage.session.set).not.toHaveBeenCalled();
  });
  it('registers a context menu only on ordinary webpages', async () => {
    api.runtime.onInstalled.emit();
    await vi.waitFor(() => expect(api.contextMenus.create).toHaveBeenCalled());
    expect(api.contextMenus.create.mock.calls[0][0]).toMatchObject({ title: 'Find with Needle', documentUrlPatterns: ['http://*/*', 'https://*/*'] });
  });
  it('reattaches the popup to existing HTTP(S) pages when the extension is loaded', async () => {
    api.tabs.query.mockResolvedValue([tab, { ...tab, id: 13, url: 'chrome://extensions/' }]);
    api.runtime.onInstalled.emit();
    await vi.waitFor(() => expect(api.scripting.executeScript).toHaveBeenCalled());
    expect(api.scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 12 }, files: ['content.js'], injectImmediately: true });
  });
  it('reattaches the popup to restored webpages after browser startup', async () => {
    api.runtime.onStartup.emit();
    await vi.waitFor(() => expect(api.scripting.executeScript).toHaveBeenCalled());
    expect(api.scripting.executeScript).toHaveBeenCalledWith({ target: { tabId: 12 }, files: ['content.js'], injectImmediately: true });
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
  it('opens the side panel synchronously with the user gesture and captures selected text without a screenshot', async () => {
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find', selectionText: 'Sony WH-1000XM5' }, tab);
    expect(api.sidePanel.open).toHaveBeenCalledWith({ tabId: 12 });
    const result = await saved();
    expect(result.selection.text).toBe('Sony WH-1000XM5');
    expect(result.needsCrop).toBe(false);
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
  it('keeps full-page pixels separate from backend selection until the user crops', async () => {
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find' }, tab);
    const result = await saved();
    expect(result.needsCrop).toBe(true);
    expect(result.screenshotDataUrl).toBe('data:image/jpeg;base64,AA==');
    expect(result.selection.imageDataUrl).toBeUndefined();
    expect(result.selection.imageUrl).toBeUndefined();
  });
  it('does not capture unsupported browser pages', async () => {
    api.action.onClicked.emit({ ...tab, url: 'chrome://settings/' });
    const result = await saved();
    expect(result.error).toContain('ordinary webpages');
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
  it('crops a single visible image locally and never attaches the complete page screenshot', async () => {
    const drawImage = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1200, height: 800, close: vi.fn() })));
    vi.stubGlobal('OffscreenCanvas', class {
      constructor(public width: number, public height: number) {}
      getContext() { return { drawImage }; }
      async convertToBlob() { return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }); }
    });
    api.scripting.executeScript.mockResolvedValue([{ result: { x: 100, y: 100, width: 300, height: 200, viewportWidth: 1200, viewportHeight: 800, text: 'Selected headphones' } }]);
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find', mediaType: 'image', srcUrl: 'https://example.com/image.jpg' }, tab);
    const result = await saved();
    expect(result.selection.imageDataUrl).toBe('data:image/jpeg;base64,AQID');
    expect(result.selection.text).toBe('Selected headphones');
    expect(result.screenshotDataUrl).toBeUndefined();
    expect(result.needsCrop).toBe(false);
    expect(drawImage).toHaveBeenCalled();
  });
  it('ignores completion of an older capture after a newer target was selected', async () => {
    let finish!: (value: string) => void;
    api.tabs.captureVisibleTab.mockImplementation(() => new Promise<string>(resolve => { finish = resolve; }));
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find' }, tab);
    await vi.waitFor(() => expect(api.tabs.captureVisibleTab).toHaveBeenCalled());
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find', selectionText: 'Newer selected item' }, tab);
    await saved();
    finish('data:image/jpeg;base64,AA==');
    await vi.waitFor(() => expect(api.tabs.onActivated.listeners.size).toBe(0));
    expect(values['needle.selection'].selection.text).toBe('Newer selected item');
    expect(api.storage.session.set).toHaveBeenCalledTimes(1);
  });
  it('rejects a tab switched before the capture', async () => {
    api.tabs.query.mockResolvedValue([{ ...tab, id: 44 }]);
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find' }, tab);
    expect((await saved()).error).toContain('tab changed');
    expect(api.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
  it('discards pixels if a tab switches during capture, even if it switches back', async () => {
    api.tabs.captureVisibleTab.mockImplementation(async () => {
      api.tabs.onActivated.emit({ tabId: 44, windowId: 1 });
      api.tabs.onActivated.emit({ tabId: 12, windowId: 1 });
      return 'data:image/jpeg;base64,AA==';
    });
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find' }, tab);
    const result = await saved();
    expect(result.error).toContain('page changed');
    expect(result.screenshotDataUrl).toBeUndefined();
    expect(api.tabs.onActivated.listeners.size).toBe(0);
    expect(api.tabs.onUpdated.listeners.size).toBe(0);
  });
  it('discards a screenshot if the source URL navigates during capture', async () => {
    api.tabs.query.mockResolvedValueOnce([tab]).mockResolvedValueOnce([{ ...tab, url: 'https://other.example.com/' }]);
    api.contextMenus.onClicked.emit({ menuItemId: 'needle-find' }, tab);
    expect((await saved()).error).toContain('page changed');
  });
});
