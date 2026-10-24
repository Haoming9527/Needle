/** Browser-only stand-in for the extension's persisted local preference. */
export function preferenceStorage() {
  const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
  const notify = (changes: Record<string, chrome.storage.StorageChange>) => listeners.forEach(listener => listener(changes, 'local'));
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && event.key === 'needle.enabled') notify({ 'needle.enabled': { newValue: event.newValue !== 'false' } });
  });
  return {
    local: {
      get: async (key: string) => ({ [key]: localStorage.getItem(key) !== 'false' }),
      set: async (values: Record<string, unknown>) => {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const [key, value] of Object.entries(values)) { localStorage.setItem(key, String(value)); changes[key] = { newValue: value }; }
        notify(changes);
      },
    },
    onChanged: { addListener: (listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => listeners.add(listener), removeListener: (listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) => listeners.delete(listener) },
  };
}
