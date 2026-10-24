import type { Offer, SearchResponse } from '../../shared/types';
import { mediaCrop } from './geometry';
import { targetAt, targetGeometry, targetText, type ShoppingTarget } from './target';

interface Popup {
  id: string; target: ShoppingTarget; pointerX: number; pointerY: number; host: HTMLDivElement; details: HTMLDivElement;
  status: HTMLParagraphElement; title: HTMLHeadingElement; price: HTMLParagraphElement;
  image: HTMLImageElement; offers: HTMLSelectElement; variants: HTMLSelectElement;
  buy: HTMLButtonElement; cart: HTMLButtonElement; result?: SearchResponse; added: boolean;
}
type ContentGlobal = typeof globalThis & { __needleContentDispose?: () => void };
const contentGlobal = globalThis as ContentGlobal;
contentGlobal.__needleContentDispose?.();
const extensionId = chrome.runtime.id;
let current: Popup | null = null;
const isX = /(^|\.)(x\.com|twitter\.com)$/.test(location.hostname);

function node<K extends keyof HTMLElementTagNameMap>(name: K, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(name);
  if (text) element.textContent = text;
  return element;
}
function send<T>(message: unknown): Promise<T> {
  try { return chrome.runtime.sendMessage(message) as Promise<T>; }
  catch { return Promise.reject(new Error('Refresh this page after reloading Needle.')); }
}
function connected(): boolean {
  try { return !!extensionId && chrome.runtime?.id === extensionId; } catch { return false; }
}
function position(popup: Popup): void {
  const box = popup.host.getBoundingClientRect();
  const left = Math.max(8, Math.min(popup.pointerX + 10, innerWidth - box.width - 8));
  const top = Math.max(8, Math.min(popup.pointerY + 10, innerHeight - box.height - 8));
  popup.host.style.setProperty('left', `${left}px`, 'important');
  popup.host.style.setProperty('top', `${top}px`, 'important');
}
function dismiss(): void {
  const popup = current;
  if (!popup) return;
  current = null;
  popup.host.remove();
  if (connected()) void send({ type: 'NEEDLE_OVERLAY_CANCEL', requestId: popup.id }).catch(() => {});
}
function chosen(popup: Popup): Offer | undefined { return popup.result?.offers.find(item => item.id === popup.offers.value); }
function formatPrice(offer: Offer): string {
  if (offer.price == null || !offer.currency) return 'Price unknown';
  try { return `${offer.currency} ${new Intl.NumberFormat('en-US', { style: 'currency', currency: offer.currency }).format(offer.price)}`; }
  catch { return `${offer.currency} ${offer.price.toLocaleString()}`; }
}
function renderOffer(popup: Popup): void {
  const offer = chosen(popup);
  popup.added = false;
  popup.cart.textContent = 'Add to cart';
  popup.variants.replaceChildren();
  if (!offer) return;
  popup.details.hidden = false;
  popup.title.textContent = offer.title;
  popup.price.textContent = formatPrice(offer);
  popup.status.textContent = `${offer.match === 'exact' ? 'Exact match' : offer.match === 'likely' ? 'Likely match' : 'Similar alternative'} · Coupang`;
  if (offer.variants.length > 1) {
    const placeholder = node('option', 'Choose a variant'); placeholder.value = ''; popup.variants.append(placeholder);
  }
  for (const variant of offer.variants) { const option = node('option', variant); option.value = variant; popup.variants.append(option); }
  popup.variants.hidden = offer.variants.length < 2;
  updateButtons(popup); position(popup);
}
function updateButtons(popup: Popup): void {
  const offer = chosen(popup);
  const ready = !!offer && (offer.variants.length < 2 || !!popup.variants.value);
  popup.buy.disabled = !ready;
  popup.cart.disabled = !ready || popup.added;
}
function fail(popup: Popup, message: string): void {
  if (current !== popup) return;
  popup.host.style.setProperty('visibility', 'visible', 'important');
  popup.status.textContent = message;
  popup.buy.disabled = true; popup.cart.disabled = true; position(popup);
}
function makePopup(target: ShoppingTarget, x: number, y: number): Popup {
  const host = node('div');
  host.style.cssText = `position:fixed!important;left:${x}px!important;top:${y}px!important;right:auto!important;bottom:auto!important;z-index:2147483647!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;width:max-content!important;height:auto!important;max-width:calc(100vw - 16px)!important;visibility:visible!important;`;
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = node('style');
  style.textContent = `
    :host{color-scheme:light}*{box-sizing:border-box}.panel{font:14px/1.4 "Segoe UI",Arial,sans-serif;color:#20242c;background:#fff;width:min(304px,calc(100vw - 16px));border:1px solid #dfe3eb;border-radius:16px;box-shadow:0 7px 28px #17242f2b;padding:7px}
    .actions{display:flex;gap:5px}button{font:600 13px "Segoe UI",Arial,sans-serif;border:0;border-radius:11px;min-height:40px;cursor:pointer;background:#f1f3f8;color:#20242c;padding:8px 14px;white-space:nowrap}button:first-child{background:#3156e8;color:#fff;flex:1}button:nth-child(2){flex:1.65}button:disabled{opacity:.5;cursor:default}button:focus-visible,select:focus-visible{outline:3px solid #8aafff;outline-offset:2px}.cancel{font-size:22px;min-width:40px;padding:4px 8px;background:transparent}
    .details{padding:12px 7px 2px}.head{display:flex;align-items:center;gap:10px}.head img{width:48px;height:48px;object-fit:cover;border-radius:8px;background:#f1f3f8}h2{font-size:14px;line-height:1.3;margin:0;font-weight:650;overflow-wrap:anywhere}.price{font-size:17px;font-weight:700;margin:5px 0 0}.status{font-size:12px;color:#6d7685;margin:8px 8px 4px;overflow-wrap:anywhere}
    select{font:13px "Segoe UI",Arial,sans-serif;width:calc(100% - 14px);padding:8px;border:1px solid #d8dfe8;border-radius:8px;background:#fff;color:#20242c;margin:8px 7px 1px}[hidden]{display:none!important}
  `;
  const panel = node('section'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Needle shopping');
  const head = node('div'); head.className = 'head';
  const image = node('img'); image.alt = 'Selected area'; image.hidden = true;
  const headings = node('div');
  const title = node('h2'); headings.append(title); head.append(image, headings);
  const price = node('p'); price.className = 'price';
  headings.append(price);
  const details = node('div'); details.className = 'details'; details.hidden = true; details.append(head);
  const status = node('p', 'Finding this item…'); status.className = 'status'; status.setAttribute('role', 'status');
  const offers = node('select'); offers.setAttribute('aria-label', 'Recommended item'); offers.hidden = true;
  const variants = node('select'); variants.setAttribute('aria-label', 'Variant'); variants.hidden = true;
  const actions = node('div'); actions.className = 'actions';
  const buy = node('button', 'Buy'); buy.type = 'button'; buy.disabled = true;
  const cart = node('button', 'Add to cart'); cart.type = 'button'; cart.disabled = true;
  const cancel = node('button', '×'); cancel.className = 'cancel'; cancel.type = 'button'; cancel.setAttribute('aria-label', 'Cancel');
  actions.append(buy, cart, cancel); panel.append(actions, details, status, offers, variants); shadow.append(style, panel); document.documentElement.append(host);
  // Chrome 114+: the top layer keeps the toolbar above fullscreen players and dialogs.
  try { host.setAttribute('popover', 'manual'); host.showPopover(); }
  catch { host.removeAttribute('popover'); }
  const popup: Popup = { id: crypto.randomUUID(), target, pointerX: x, pointerY: y, host, details, status, title, price, image, offers, variants, buy, cart, added: false };
  position(popup);
  offers.addEventListener('change', () => renderOffer(popup));
  variants.addEventListener('change', () => { popup.added = false; popup.cart.textContent = 'Add to cart'; updateButtons(popup); });
  cancel.addEventListener('click', dismiss);
  for (const [button, type] of [[buy, 'NEEDLE_OVERLAY_BUY'], [cart, 'NEEDLE_OVERLAY_CART']] as const) {
    button.addEventListener('click', () => {
      const offer = chosen(popup);
      if (!offer) return;
      buy.disabled = true; cart.disabled = true;
      void send<{ error?: string }>({ type, requestId: popup.id, offerId: offer.id, variant: variants.value || undefined }).then(response => {
        if (current !== popup) return;
        if (response?.error) { popup.status.textContent = response.error; updateButtons(popup); return; }
        if (type === 'NEEDLE_OVERLAY_BUY') { dismiss(); return; }
        popup.added = true; cart.textContent = 'Added'; popup.status.textContent = 'Saved to your cart.'; updateButtons(popup);
      }).catch(() => { if (current === popup) { popup.status.textContent = 'Refresh this page after reloading Needle.'; updateButtons(popup); } });
    });
  }
  return popup;
}

// Old isolated worlds can outlive an extension reload; yield to the new listener.
function onContextMenu(event: MouseEvent): void {
  if (!connected() || !event.isTrusted || event.shiftKey || (current && event.composedPath().includes(current.host))) return;
  const target = targetAt(event);
  if (!target) return;
  event.preventDefault(); event.stopImmediatePropagation();
  dismiss();
  const popup = makePopup(target, event.clientX, event.clientY);
  current = popup;
  void send<{ result?: SearchResponse; imageDataUrl?: string; error?: string }>({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: popup.id }).then(response => {
    if (current !== popup) return;
    popup.host.style.setProperty('visibility', 'visible', 'important');
    if (!response?.result || response.error) { fail(popup, response?.error || 'Refresh the page after loading Needle, then right-click again.'); return; }
    popup.result = response.result;
    if (response.imageDataUrl) { imagePreview(popup, response.imageDataUrl); }
    if (!response.result.offers.length) { popup.status.textContent = response.result.interpretation.clarification || response.result.webSearch?.message || 'No close match. Right-click closer to the object, or describe it in Needle.'; position(popup); return; }
    for (const offer of response.result.offers) { const option = node('option', offer.title); option.value = offer.id; popup.offers.append(option); }
    popup.offers.hidden = response.result.offers.length < 2;
    renderOffer(popup);
  }).catch(() => fail(popup, 'Needle was reloaded. Refresh this page and try again.'));
}
function imagePreview(popup: Popup, source: string): void { if (/^data:image\/jpeg;base64,/.test(source)) { popup.image.src = source; popup.image.hidden = false; } }

function onKeyDown(event: KeyboardEvent): void { if (event.key === 'Escape' && current) { event.stopImmediatePropagation(); dismiss(); } }
function onPointerDown(event: PointerEvent): void { if (current && !event.composedPath().includes(current.host)) dismiss(); }
function onResize(): void { if (current) position(current); }
const onMessage: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, sender, respond) => {
  const popup = current;
  if (sender.id !== chrome.runtime.id || !popup || message?.requestId !== popup.id) return;
  if (message.type === 'NEEDLE_CAPTURE_FINISHED') { popup.host.style.setProperty('visibility', 'visible', 'important'); respond({ ok: true }); return; }
  if (!['NEEDLE_PREPARE_CAPTURE', 'NEEDLE_VALIDATE_CAPTURE'].includes(message.type)) return;
  const prepare = () => {
    if (current !== popup) { respond({ error: 'Selection cancelled' }); return; }
    try {
      const box = targetGeometry(popup.target, popup.pointerX, popup.pointerY); mediaCrop(box);
      respond({ geometry: box, ...targetText(popup.target, isX) });
    } catch { respond({ error: 'The media moved. Right-click it again.' }); }
  };
  if (message.type === 'NEEDLE_PREPARE_CAPTURE') {
    popup.host.style.setProperty('visibility', 'hidden', 'important');
    requestAnimationFrame(() => requestAnimationFrame(prepare));
  } else prepare();
  return true;
};
window.addEventListener('contextmenu', onContextMenu, { capture: true });
window.addEventListener('keydown', onKeyDown, { capture: true });
window.addEventListener('pointerdown', onPointerDown, { capture: true });
window.addEventListener('pagehide', dismiss);
window.addEventListener('resize', onResize);
chrome.runtime.onMessage.addListener(onMessage);
contentGlobal.__needleContentDispose = () => {
  dismiss();
  window.removeEventListener('contextmenu', onContextMenu, { capture: true });
  window.removeEventListener('keydown', onKeyDown, { capture: true });
  window.removeEventListener('pointerdown', onPointerDown, { capture: true });
  window.removeEventListener('pagehide', dismiss);
  window.removeEventListener('resize', onResize);
  try { chrome.runtime.onMessage.removeListener(onMessage); } catch { /* Previous extension context was invalidated. */ }
};
