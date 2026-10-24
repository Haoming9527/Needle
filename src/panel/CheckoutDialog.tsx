import { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import type { DemoOrder, DemoOrderRequest, Offer } from '../../shared/types';
import { apiRequest } from './api';
import { formatMoney, ProductImage } from './ui';

export function assetUrl(url: string | null | undefined) { return url?.startsWith('/assets/') ? url.slice(1) : url; }
export interface CheckoutSelection { offer: Offer; sessionId: string; action: 'buy' | 'cart'; cartItemId?: string; variant?: string | null; quantity?: number }

export function CheckoutDialog({ offer, sessionId, action, cartItemId, variant: initialVariant, quantity = 1, onClose, onComplete }: CheckoutSelection & { onClose: () => void; onComplete: (order?: DemoOrder) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [variant, setVariant] = useState(initialVariant ?? (offer.variants.length === 1 ? offer.variants[0] : ''));
  const [confirmationId] = useState(() => crypto.randomUUID());
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const isCart = action === 'cart';

  useEffect(() => {
    const node = dialog.current; node?.showModal();
    return () => { node?.close(); controller.current?.abort(); };
  }, []);

  async function confirm() {
    if (inFlight.current || (offer.variants.length > 0 && !variant)) return;
    inFlight.current = true; setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 45000);
    try {
      if (isCart) {
        await apiRequest('/cart', { sessionId, offerId: offer.id, variant: variant || undefined, quantity }, abort.signal);
        onComplete(); onClose();
      } else {
        const request: DemoOrderRequest = { sessionId, offerId: offer.id, variant: variant || undefined, quantity, confirmationId, confirmed: true, ...(cartItemId ? { cartItemId } : {}) };
        const receipt = await apiRequest<DemoOrder>('/orders', request, abort.signal);
        setOrder(receipt); onComplete(receipt);
      }
    } catch (failure) {
      setError(abort.signal.aborted ? 'The request timed out. You can retry this confirmation safely.' : failure instanceof Error ? failure.message : 'The item could not be saved. Try again.');
    } finally { clearTimeout(timeout); inFlight.current = false; setBusy(false); }
  }

  return <dialog ref={dialog} className="sheet checkout-dialog" aria-labelledby="checkout-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="sheet-header"><h2 id="checkout-title">{order ? 'Purchase saved' : isCart ? 'Add to cart' : 'Review purchase'}</h2><button className="icon-button" aria-label="Close checkout" disabled={busy} onClick={onClose}><X size={19} /></button></header>
    {order ? <div className="receipt">
      <span className="receipt-check"><Check size={26} /></span><p className="receipt-lead">It’s in your purchase history.</p>
      <div className="checkout-product"><ProductImage src={assetUrl(offer.imageUrl)} alt={order.title} /><div><h3>{order.title}</h3><p>{order.variant}{quantity > 1 ? ` · ${quantity} items` : ''}</p><strong>{formatMoney(order.price == null ? null : order.price * (order.quantity ?? quantity), order.currency)}</strong></div></div>
      <dl className="checkout-facts"><div><dt>Reference</dt><dd>{order.id}</dd></div><div><dt>Status</dt><dd>Completed</dd></div></dl>
      <button className="primary-button full-width" onClick={onClose}>Done</button>
    </div> : <>
      <div className="checkout-product"><ProductImage src={assetUrl(offer.imageUrl)} alt={offer.title} /><div><h3>{offer.title}</h3><strong>{formatMoney(offer.price == null ? null : offer.price * quantity, offer.currency)}</strong>{quantity > 1 && <p>{quantity} × {formatMoney(offer.price, offer.currency)}</p>}</div></div>
      {offer.variants.length > 0 && <label className="field-label">Variant<select value={variant} disabled={!!cartItemId || busy} onChange={event => setVariant(event.target.value)}><option value="" disabled>Choose a variant</option>{offer.variants.map(option => <option key={option} value={option}>{option}</option>)}</select></label>}
      {!isCart && <dl className="checkout-facts"><div><dt>Merchant</dt><dd>Coupang</dd></div><div><dt>Shipping</dt><dd>{offer.shipping ?? 'Unknown'}</dd></div><div><dt>Availability</dt><dd>{offer.availability ?? 'Unknown'}</dd></div><div><dt>Returns</dt><dd>{offer.returns ?? 'Unknown'}</dd></div></dl>}
      {offer.sourceUrl && <a className="source-link" href={offer.sourceUrl} target="_blank" rel="noreferrer">View on Coupang <ExternalLink size={13} /></a>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary-button full-width confirm-purchase" onClick={() => void confirm()} disabled={busy || (offer.variants.length > 0 && !variant)}>{busy ? <><span className="button-spinner" /> Saving…</> : isCart ? 'Add to cart' : 'Confirm purchase'}</button>
    </>}
  </dialog>;
}
