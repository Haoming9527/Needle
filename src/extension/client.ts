import type { CapturedSelection } from '../../shared/types';
export { getShoppingEnabled, setShoppingEnabled, subscribeToShoppingEnabled } from './preferences';

export const API_BASE = 'http://127.0.0.1:4318';
export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
const KEY = 'needle.selection';

export async function getCapturedSelection(): Promise<CapturedSelection | null> {
  if (!isExtension) return null;
  const value = await chrome.storage.session.get(KEY);
  const captured = value[KEY] as CapturedSelection | undefined;
  return captured && typeof captured.id === 'string' && captured.selection ? captured : null;
}

export function subscribeToSelection(callback: (selection: CapturedSelection) => void): () => void {
  if (!isExtension) return () => {};
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'session' && changes[KEY]?.newValue) callback(changes[KEY].newValue as CapturedSelection);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function requestCapture(): Promise<CapturedSelection> {
  if (!isExtension) throw new Error('To capture a webpage, load the Needle extension and right-click the page. You can also use the sample examples below.');
  const result = await chrome.runtime.sendMessage({ type: 'NEEDLE_CAPTURE' }) as { selection?: CapturedSelection; error?: string };
  if (result.error || !result.selection) throw new Error(result.error ?? 'Capture failed. Right-click the webpage and try again.');
  return result.selection;
}

export async function clearCapturedSelection(): Promise<void> {
  if (isExtension) await chrome.storage.session.remove(KEY);
}
