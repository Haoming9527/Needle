import { useEffect, useRef, useState } from 'react';
import { getShoppingEnabled, setShoppingEnabled, subscribeToShoppingEnabled } from '../../extension/transport/client';

export function ShoppingSwitch({ onChange }: { onChange: (enabled: boolean) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(false);
  const version = useRef(0);

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    const initialVersion = version.current;
    const unsubscribe = subscribeToShoppingEnabled(value => {
      if (!alive) return;
      version.current++; setEnabled(value); onChange(value); setError('');
    });
    void getShoppingEnabled().then(value => {
      if (alive && version.current === initialVersion) { setEnabled(value); onChange(value); }
    }).catch(() => {
      if (alive && version.current === initialVersion) { setEnabled(false); onChange(false); setError('Could not read the switch. Try again.'); }
    });
    return () => { alive = false; mounted.current = false; unsubscribe(); };
  }, [onChange]);

  async function toggle() {
    if (enabled === null || busy.current) return;
    const next = !enabled, updateVersion = version.current;
    busy.current = true; setSaving(true); setError('');
    try {
      await setShoppingEnabled(next);
      if (mounted.current && version.current === updateVersion) { setEnabled(next); onChange(next); }
    } catch {
      if (mounted.current) setError('Could not save the switch. Try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <div className="shopping-switch-wrap">
    <button type="button" className="shopping-switch" role="switch" aria-label="Right-click shopping" aria-checked={enabled === true} aria-busy={saving || enabled === null} disabled={saving || enabled === null} title="Turn right-click shopping on or off" onClick={() => void toggle()}>
      <span className="shopping-switch-track" aria-hidden="true"><span /></span>
      <span aria-hidden="true">{enabled === null ? '…' : enabled ? 'On' : 'Off'}</span>
    </button>
    {error && <span className="shopping-switch-error" role="alert">{error}</span>}
  </div>;
}
