export const SHOPPING_ENABLED_KEY = 'needle.enabled';

const localListeners = new Set<(enabled: boolean) => void>();
function extensionStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

/** A missing preference is enabled; an unreadable preference is never guessed. */
export async function getShoppingEnabled(): Promise<boolean> {
  if (extensionStorage()) {
    const values = await chrome.storage.local.get(SHOPPING_ENABLED_KEY);
    return values[SHOPPING_ENABLED_KEY] !== false;
  }
  return localStorage.getItem(SHOPPING_ENABLED_KEY) !== 'false';
}

export async function setShoppingEnabled(enabled: boolean): Promise<void> {
  if (extensionStorage()) {
    await chrome.storage.local.set({ [SHOPPING_ENABLED_KEY]: enabled });
    return;
  }
  localStorage.setItem(SHOPPING_ENABLED_KEY, String(enabled));
  // The native storage event only reaches other documents.
  for (const listener of localListeners) listener(enabled);
}

export function subscribeToShoppingEnabled(listener: (enabled: boolean) => void): () => void {
  if (extensionStorage()) {
    const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && SHOPPING_ENABLED_KEY in changes) listener(changes[SHOPPING_ENABLED_KEY].newValue !== false);
    };
    chrome.storage.onChanged.addListener(changed);
    return () => chrome.storage.onChanged.removeListener(changed);
  }
  const changed = (event: StorageEvent) => {
    if (event.storageArea === localStorage && (event.key === SHOPPING_ENABLED_KEY || event.key === null)) listener(event.newValue !== 'false');
  };
  localListeners.add(listener);
  window.addEventListener('storage', changed);
  return () => { localListeners.delete(listener); window.removeEventListener('storage', changed); };
}

export interface ShoppingGate {
  ready: Promise<boolean>;
  isEnabled(): boolean;
  signal(): AbortSignal;
  assertEnabled(): void;
  dispose(): void;
}

/** Start closed until persisted settings load, and never overwrite a newer change. */
export function createShoppingGate(onChange?: (enabled: boolean) => void): ShoppingGate {
  let enabled = false, disposed = false, version = 0;
  let controller = new AbortController(); controller.abort();
  const apply = (value: boolean) => {
    if (disposed) return;
    enabled = value;
    if (value) { if (controller.signal.aborted) controller = new AbortController(); }
    else controller.abort();
    onChange?.(value);
  };
  const unsubscribe = subscribeToShoppingEnabled(value => { version++; apply(value); });
  const ready = getShoppingEnabled().then(value => { if (version === 0) apply(value); return enabled; });
  return {
    ready, isEnabled: () => enabled && !disposed, signal: () => controller.signal,
    assertEnabled() { if (!enabled || disposed) throw new Error('Needle is off. Turn it on in the side panel to shop with right-click.'); },
    dispose() { disposed = true; controller.abort(); unsubscribe(); },
  };
}
