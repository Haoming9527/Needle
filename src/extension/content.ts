import type { Offer, SearchResponse } from '../../shared/types';
import { offerSource } from '../../shared/offer-source';
import { mediaCrop } from './geometry';
import { targetAt, targetGeometry, targetText, type ShoppingTarget } from './target';

interface Popup {
  id: string; target: ShoppingTarget; pointerX: number; pointerY: number; host: HTMLDivElement; details: HTMLDivElement;
  status: HTMLParagraphElement; title: HTMLHeadingElement; price: HTMLParagraphElement;
  image: HTMLImageElement; offers: HTMLSelectElement; variants: HTMLSelectElement;
  buy: HTMLButtonElement; cart: HTMLButtonElement; save: HTMLButtonElement; find: HTMLButtonElement; result?: SearchResponse; added: boolean;
  loading: HTMLDivElement; loadingTitle: HTMLElement; loadingTip: HTMLParagraphElement; loadingTime: HTMLSpanElement;
  loadingTimer?: ReturnType<typeof setInterval>;
  panel: HTMLElement; reply: HTMLFormElement; answer: HTMLInputElement; submit: HTMLButtonElement;
  pending: boolean; anchorLeft?: number; anchorTop?: number;
}
interface DiscoveryReply { result?: SearchResponse; imageDataUrl?: string; error?: string }
type ContentGlobal = typeof globalThis & { __needleContentDispose?: () => void };
const contentGlobal = globalThis as ContentGlobal;
contentGlobal.__needleContentDispose?.();
const extensionId = chrome.runtime.id;
let current: Popup | null = null;
const isX = /(^|\.)(x\.com|twitter\.com)$/.test(location.hostname);
const searchTips = ['Refine by color, style, or budget.', 'Prices keep their original currency.', 'Source links live in Product details.', 'A closer crop helps focus on one object.'];

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
  // Reserve room for a question or result before anchoring. Content changes must
  // never move the controls away from the shopper's pointer.
  const width = Math.min(304, innerWidth - 16), reservedHeight = Math.min(360, innerHeight - 16);
  const left = Math.max(8, Math.min(popup.anchorLeft ?? popup.pointerX + 10, innerWidth - width - 8));
  const top = Math.max(8, Math.min(popup.anchorTop ?? popup.pointerY + 10, innerHeight - reservedHeight - 8));
  popup.anchorLeft = left; popup.anchorTop = top;
  popup.host.style.setProperty('left', `${left}px`, 'important');
  popup.host.style.setProperty('top', `${top}px`, 'important');
  popup.host.style.setProperty('--needle-max-height', `${Math.max(1, innerHeight - top - 8)}px`);
}
function dismiss(): void {
  const popup = current;
  if (!popup) return;
  current = null;
  stopLoading(popup);
  popup.host.remove();
  if (connected()) void send({ type: 'NEEDLE_OVERLAY_CANCEL', requestId: popup.id }).catch(() => {});
}
function stopLoading(popup: Popup): void {
  if (popup.loadingTimer !== undefined) { clearInterval(popup.loadingTimer); popup.loadingTimer = undefined; }
  popup.loading.hidden = true;
  popup.status.hidden = false;
}
function startLoading(popup: Popup): void {
  stopLoading(popup);
  popup.pending = true;
  popup.loading.hidden = false; popup.status.hidden = true;
  popup.loadingTime.textContent = '0s';
  popup.loadingTitle.textContent = 'Finding what caught your eye…';
  popup.loadingTip.textContent = searchTips[0];
  const started = Date.now();
  popup.loadingTimer = setInterval(() => {
    if (current !== popup) { stopLoading(popup); return; }
    const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
    popup.loadingTime.textContent = `${elapsed}s`;
    popup.loadingTitle.textContent = elapsed >= 30 ? 'Still looking for a close fit…' : 'Finding what caught your eye…';
    popup.loadingTip.textContent = searchTips[Math.floor(elapsed / 7) % searchTips.length];
  }, 1000);
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
  popup.buy.hidden = false; popup.cart.hidden = false; popup.find.hidden = true;
  popup.title.textContent = offer.title;
  popup.price.textContent = formatPrice(offer);
  popup.status.textContent = `${offer.match === 'exact' ? 'Exact match' : offer.match === 'likely' ? 'Likely match' : 'Similar alternative'} · ${offerSource(offer).label}`;
  if (offer.variants.length > 1) {
    const placeholder = node('option', 'Choose a variant'); placeholder.value = ''; popup.variants.append(placeholder);
  }
  for (const variant of offer.variants) { const option = node('option', variant); option.value = variant; popup.variants.append(option); }
  popup.variants.hidden = offer.variants.length < 2;
  updateButtons(popup);
}
function updateButtons(popup: Popup): void {
  const offer = chosen(popup);
  const ready = !popup.pending && !popup.result?.interpretation.needsClarification && !!offer && (offer.variants.length < 2 || !!popup.variants.value);
  popup.buy.disabled = !ready;
  popup.cart.disabled = !ready || popup.added;
}
function fail(popup: Popup, message: string): void {
  if (current !== popup) return;
  stopLoading(popup);
  popup.pending = false;
  popup.find.disabled = false;
  popup.answer.disabled = false;
  popup.submit.disabled = !popup.answer.value.trim();
  popup.host.style.setProperty('visibility', 'visible', 'important');
  popup.status.textContent = message;
  popup.buy.disabled = true; popup.cart.disabled = true;
}
function showResponse(popup: Popup, response: DiscoveryReply | undefined): void {
  if (current !== popup) return;
  stopLoading(popup);
  popup.pending = false;
  popup.host.style.setProperty('visibility', 'visible', 'important');
  if (!response?.result || response.error) { fail(popup, response?.error || 'Refresh the page after loading Needle, then right-click again.'); return; }
  popup.result = response.result;
  popup.offers.replaceChildren(); popup.offers.hidden = true;
  popup.variants.replaceChildren(); popup.variants.hidden = true;
  popup.details.hidden = true;
  popup.reply.remove();
  popup.answer.disabled = false; popup.answer.value = ''; popup.submit.disabled = true;
  if (response.imageDataUrl) imagePreview(popup, response.imageDataUrl);
  if (response.result.interpretation.needsClarification) {
    popup.status.textContent = response.result.interpretation.clarification || 'Which object near your cursor would you like?';
    popup.panel.append(popup.reply);
    updateButtons(popup);
    return;
  }
  if (!response.result.offers.length) {
    popup.status.textContent = response.result.webSearch?.message || 'No close match. Right-click closer to the object, or describe it in Needle.';
    updateButtons(popup); return;
  }
  for (const offer of response.result.offers) { const option = node('option', offer.title); option.value = offer.id; popup.offers.append(option); }
  popup.offers.value = response.result.offers[0].id;
  popup.offers.hidden = response.result.offers.length < 2;
  renderOffer(popup);
}
function answerQuestion(popup: Popup): void {
  const answer = popup.answer.value.trim();
  if (current !== popup || popup.pending || !answer || !popup.result?.interpretation.needsClarification) return;
  popup.answer.disabled = true; popup.submit.disabled = true;
  startLoading(popup); updateButtons(popup);
  void send<DiscoveryReply>({ type: 'NEEDLE_OVERLAY_CLARIFY', requestId: popup.id, answer })
    .then(response => showResponse(popup, response))
    .catch(() => fail(popup, 'Could not send your answer. Try again, or refresh after reloading Needle.'));
}
function makePopup(target: ShoppingTarget, x: number, y: number): Popup {
  const host = node('div');
  host.style.cssText = `position:fixed!important;left:${x}px!important;top:${y}px!important;right:auto!important;bottom:auto!important;z-index:2147483647!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;width:max-content!important;height:auto!important;max-width:calc(100vw - 16px)!important;visibility:visible!important;animation:none!important;transition:none!important;transform:none!important;`;
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = node('style');
  style.textContent = `
    :host{color-scheme:light}*{box-sizing:border-box}.panel{font:14px/1.4 "Segoe UI",Arial,sans-serif;color:#20242c;background:#fff;width:min(304px,calc(100vw - 16px));max-height:var(--needle-max-height,calc(100vh - 16px));overflow:auto;overscroll-behavior:contain;border:1px solid #dfe3eb;border-radius:16px;box-shadow:0 7px 28px #17242f2b;padding:7px}
    .actions{display:flex;gap:5px;position:sticky;top:0;background:#fff;z-index:1}button{font:600 13px "Segoe UI",Arial,sans-serif;border:0;border-radius:11px;min-height:40px;cursor:pointer;background:#f1f3f8;color:#20242c;padding:8px 14px;white-space:nowrap}.actions>button:first-child{background:#3156e8;color:#fff;flex:1}.actions>button:nth-child(2){flex:1.65}button:disabled{opacity:.5;cursor:default}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #8aafff;outline-offset:2px}.cancel{font-size:22px;min-width:40px;padding:4px 8px;background:transparent}
    .details{padding:12px 7px 2px}.head{display:flex;align-items:center;gap:10px}.head img{width:48px;height:48px;object-fit:cover;border-radius:8px;background:#f1f3f8}h2{font-size:14px;line-height:1.3;margin:0;font-weight:650;overflow-wrap:anywhere}.price{font-size:17px;font-weight:700;margin:5px 0 0}.status{font-size:12px;color:#6d7685;margin:8px 8px 4px;overflow-wrap:anywhere}
    select{font:13px "Segoe UI",Arial,sans-serif;width:calc(100% - 14px);padding:8px;border:1px solid #d8dfe8;border-radius:8px;background:#fff;color:#20242c;margin:8px 7px 1px}[hidden]{display:none!important}
    .reply{margin:12px 7px 6px}.reply label{display:block;font-size:11px;font-weight:600;color:#6d7685;margin:0 0 6px}.reply-row{display:flex;gap:6px}.reply input{min-width:0;flex:1;width:100%;font:13px "Segoe UI",Arial,sans-serif;padding:10px;border:1px solid #d8dfe8;border-radius:9px;background:#fff;color:#20242c}.reply button{background:#3156e8;color:white;padding:8px 12px}.reply input:disabled{background:#f7f9ff;color:#6d7685}
    .looking{margin:10px 3px 3px;padding:12px;background:#f7f9ff;border-radius:10px}.looking-head{display:flex;align-items:center;gap:10px}.looking-title{font-size:12px;font-weight:600;flex:1;line-height:1.45}.looking-time{font-size:10px;font-variant-numeric:tabular-nums;color:#8792a6}.looking-tip{font-size:11px;line-height:1.5;color:#77849a;margin:11px 0 0;padding-top:9px;border-top:1px solid #e5eaf6;min-height:26px}.looking-lens{position:relative;width:27px;height:27px;flex:0 0 27px;border:1px solid #b5c4ec;border-radius:50%;background:#edf2ff;overflow:hidden}.looking-lens:before{content:"";position:absolute;inset:7px;border:2px solid #3156e8;border-radius:50%;animation:needle-lens 2.4s ease-in-out infinite}.looking-lens:after{content:"";position:absolute;left:0;right:0;height:1px;top:0;background:#5c7bdb;animation:needle-line 2.8s ease-in-out infinite}
    @keyframes needle-lens{50%{transform:scale(.65);opacity:.5}}@keyframes needle-line{0%,100%{transform:translateY(0);opacity:0}20%,80%{opacity:1}50%{transform:translateY(27px)}}@media(prefers-reduced-motion:reduce){.looking-lens:before,.looking-lens:after{animation:none}.looking-lens:after{top:50%;opacity:.5}}
  `;
  const panel = node('section'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Needle shopping');
  const head = node('div'); head.className = 'head';
  const image = node('img'); image.alt = 'Selected area'; image.hidden = true;
  const headings = node('div');
  const title = node('h2'); headings.append(title); head.append(image, headings);
  const price = node('p'); price.className = 'price';
  headings.append(price);
  const details = node('div'); details.className = 'details'; details.hidden = true; details.append(head);
  const status = node('p', 'Save an idea, or look for a product.'); status.className = 'status'; status.setAttribute('role', 'status');
  const loading = node('div'); loading.className = 'looking'; loading.hidden = true;
  const loadingHead = node('div'); loadingHead.className = 'looking-head';
  const lens = node('span'); lens.className = 'looking-lens'; lens.setAttribute('aria-hidden', 'true');
  const loadingTitle = node('strong', 'Finding what caught your eye…'); loadingTitle.className = 'looking-title'; loadingTitle.setAttribute('role', 'status');
  const loadingTime = node('span', '0s'); loadingTime.className = 'looking-time'; loadingTime.setAttribute('aria-hidden', 'true');
  const loadingTip = node('p', searchTips[0]); loadingTip.className = 'looking-tip';
  loadingHead.append(lens, loadingTitle, loadingTime); loading.append(loadingHead, loadingTip);
  const offers = node('select'); offers.setAttribute('aria-label', 'Recommended item'); offers.hidden = true;
  const variants = node('select'); variants.setAttribute('aria-label', 'Variant'); variants.hidden = true;
  const actions = node('div'); actions.className = 'actions';
  const buy = node('button', 'Buy'); buy.type = 'button'; buy.disabled = true;
  const cart = node('button', 'Add to cart'); cart.type = 'button'; cart.disabled = true;
  buy.hidden = true; cart.hidden = true;
  const save = node('button', 'Save inspiration'); save.type = 'button';
  const find = node('button', 'Find products'); find.type = 'button';
  const cancel = node('button', '×'); cancel.className = 'cancel'; cancel.type = 'button'; cancel.setAttribute('aria-label', 'Cancel');
  const reply = node('form'); reply.className = 'reply'; reply.setAttribute('aria-label', 'Answer Needle');
  const answerLabel = node('label', 'Your answer');
  const answer = node('input'); answer.type = 'text'; answer.maxLength = 1000; answer.required = true; answer.autocomplete = 'off'; answer.placeholder = 'e.g. The black instrument'; answer.setAttribute('aria-label', 'Your answer');
  const answerId = `needle-answer-${crypto.randomUUID()}`; answer.id = answerId; answerLabel.htmlFor = answerId;
  const submit = node('button', 'Search'); submit.type = 'submit'; submit.disabled = true;
  const replyRow = node('div'); replyRow.className = 'reply-row'; replyRow.append(answer, submit); reply.append(answerLabel, replyRow);
  actions.style.flexWrap = 'wrap';
  actions.append(save, find, buy, cart, cancel); panel.append(actions, loading, details, status, offers, variants); shadow.append(style, panel); document.documentElement.append(host);
  // Chrome 114+: the top layer keeps the toolbar above fullscreen players and dialogs.
  try { host.setAttribute('popover', 'manual'); host.showPopover(); }
  catch { host.removeAttribute('popover'); }
  const popup: Popup = { id: crypto.randomUUID(), target, pointerX: x, pointerY: y, host, panel, details, status, title, price, image, offers, variants, buy, cart, save, find, added: false, loading, loadingTitle, loadingTip, loadingTime, reply, answer, submit, pending: false };
  position(popup);
  offers.addEventListener('change', () => renderOffer(popup));
  variants.addEventListener('change', () => { popup.added = false; popup.cart.textContent = 'Add to cart'; updateButtons(popup); });
  cancel.addEventListener('click', dismiss);
  find.addEventListener('click', () => startDiscovery(popup));
  save.addEventListener('click', () => {
    save.disabled = true; popup.status.textContent = 'Saving selected context…';
    void send<{ error?: string }>({ type: 'NEEDLE_OVERLAY_SAVE', requestId: popup.id }).then(result => {
      if (current !== popup) return;
      if (result?.error) { popup.status.textContent = result.error; save.disabled = false; return; }
      save.textContent = 'Saved'; popup.status.textContent = 'Saved to your collection inbox. Open Needle → Saved to organise it.';
    }).catch(() => { if (current === popup) { popup.status.textContent = 'Could not save. Try again.'; save.disabled = false; } });
  });
  answer.addEventListener('input', () => { submit.disabled = popup.pending || !answer.value.trim(); });
  reply.addEventListener('submit', event => { event.preventDefault(); answerQuestion(popup); });
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
  if (!target.element && event.target instanceof Element) target.contextElement = event.target;
  event.preventDefault(); event.stopImmediatePropagation();
  dismiss();
  const popup = makePopup(target, event.clientX, event.clientY);
  current = popup;
}
function startDiscovery(popup: Popup): void {
  if (current !== popup || popup.pending || popup.find.disabled) return;
  popup.find.disabled = true;
  startLoading(popup);
  void send<DiscoveryReply>({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: popup.id })
    .then(response => showResponse(popup, response))
    .catch(() => fail(popup, 'Needle was reloaded. Refresh this page and try again.'));
}
function imagePreview(popup: Popup, source: string): void { if (/^data:image\/jpeg;base64,/.test(source)) { popup.image.src = source; popup.image.hidden = false; } }

function onKeyDown(event: KeyboardEvent): void { if (event.key === 'Escape' && current) { event.stopImmediatePropagation(); dismiss(); } }
function onPointerDown(event: PointerEvent): void { if (current && !event.composedPath().includes(current.host)) dismiss(); }
function onResize(): void { if (current) position(current); }
const onMessage: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, sender, respond) => {
  const popup = current;
  if (sender.id !== chrome.runtime.id || !popup || message?.requestId !== popup.id) return;
  if (message.type === 'NEEDLE_READ_CONTEXT') { respond(targetText(popup.target, isX)); return; }
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
