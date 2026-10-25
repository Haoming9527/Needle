import { Check, History, ShoppingCart, Trash2 } from 'lucide-react';
import type { CartItem, DemoOrder } from '../../../shared/types';
import { assetUrl, type CheckoutSelection } from './CheckoutDialog';
import { formatMoney, ProductImage } from './ui';

export function Cart({ items, busy, onUpdate, onCheckout, onFind }: { items: CartItem[]; busy: boolean; onUpdate: (path: string, body: unknown) => void; onCheckout: (value: CheckoutSelection) => void; onFind: () => void }) {
  if (!items.length) return <div className="empty-state"><ShoppingCart size={30} /><h2>A place for your finds</h2><p>Add an item to keep it here for later.</p><button className="secondary-button" onClick={onFind}>Find an item</button></div>;
  const subtotals = new Map<string, number>();
  for (const item of items) if (item.offer.price != null && item.offer.currency) subtotals.set(item.offer.currency, (subtotals.get(item.offer.currency) ?? 0) + item.offer.price * item.quantity);
  return <><div className="saved-items">{items.map(item => <article className="saved-item" key={item.id}>
    <div className="saved-item-body"><ProductImage src={assetUrl(item.offer.imageUrl)} alt={item.offer.title} /><div><h2>{item.offer.title}</h2><p>{item.variant ?? 'Default option'}</p><strong>{formatMoney(item.offer.price, item.offer.currency)}</strong></div></div>
    <div className="cart-item-controls"><label>Qty<select aria-label={`Quantity for ${item.offer.title}`} value={item.quantity} disabled={busy} onChange={event => onUpdate(`/cart/${encodeURIComponent(item.id)}/quantity`, { quantity: Number(event.target.value) })}>{Array.from({ length: Math.max(10, item.quantity) }, (_, index) => <option key={index + 1}>{index + 1}</option>)}</select></label><button className="icon-button" aria-label={`Remove ${item.offer.title}`} disabled={busy} onClick={() => onUpdate(`/cart/${encodeURIComponent(item.id)}/remove`, {})}><Trash2 size={16} /></button><button className="primary-button" onClick={() => onCheckout({ offer: item.offer, sessionId: item.sessionId, action: 'buy', cartItemId: item.id, variant: item.variant, quantity: item.quantity })} disabled={busy}>Buy</button></div>
  </article>)}</div><div className="cart-totals"><span>Item subtotal</span><div>{[...subtotals].map(([code, total]) => <strong key={code}>{formatMoney(total, code)}</strong>)}{items.some(item => item.offer.price == null || !item.offer.currency) && <small>Some prices are unknown</small>}</div></div><p className="small-note">Shipping and other charges are unknown.</p></>;
}

export function PurchaseHistory({ orders }: { orders: DemoOrder[] }) {
  if (!orders.length) return <div className="empty-state"><History size={30} /><h2>Your finds, remembered</h2><p>Confirmed purchases appear here.</p></div>;
  return <div className="saved-items">{orders.map(order => <article className="saved-item history-item" key={order.id}><div className="saved-item-body"><ProductImage src={assetUrl(order.imageUrl)} alt={order.title} /><div><h2>{order.title}</h2><p>{order.variant ?? 'Default option'}{(order.quantity ?? 1) > 1 ? ` · ${order.quantity} items` : ''}</p><strong>{formatMoney(order.price == null ? null : order.price * (order.quantity ?? 1), order.currency)}</strong></div></div><div className="history-meta"><span>{new Date(order.createdAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}</span><span>{order.id}</span></div><span className="history-status"><Check size={12} />Completed</span></article>)}</div>;
}

