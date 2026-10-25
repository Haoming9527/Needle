import type { Offer, SearchResponse } from '../../shared/types';
import { offerSource } from '../../shared/offer-source';
import { searchRecoveryQuestion } from '../../shared/search-recovery';
import { mediaCrop } from './capture/geometry';
import { targetAt, targetGeometry, targetText, type ShoppingTarget } from './capture/target';
import { createVoiceSession, type VoiceSession, type VoiceState } from '../voice/voice-client';
import { createShoppingGate } from './storage/preferences';

interface Popup {
  id: string; target: ShoppingTarget; pointerX: number; pointerY: number; host: HTMLDivElement; details: HTMLDivElement;
  status: HTMLParagraphElement; title: HTMLHeadingElement; price: HTMLParagraphElement;
  image: HTMLImageElement; offers: HTMLSelectElement; variants: HTMLSelectElement;
  buy: HTMLButtonElement; cart: HTMLButtonElement; result?: SearchResponse; added: boolean;
  loading: HTMLDivElement; loadingTitle: HTMLElement; loadingTip: HTMLParagraphElement; loadingTime: HTMLSpanElement;
  loadingTimer?: ReturnType<typeof setInterval>;
  panel: HTMLElement; reply: HTMLFormElement; answer: HTMLInputElement; submit: HTMLButtonElement;
  targetSpot: HTMLSpanElement;
  voice?: VoiceSession; voiceState: VoiceState; record: HTMLButtonElement; voiceStatus: HTMLParagraphElement;
  pending: boolean;
}
interface DiscoveryReply { result?: SearchResponse; imageDataUrl?: string; error?: string }
type ContentGlobal = typeof globalThis & { __needleContentDispose?: () => void };
const contentGlobal = globalThis as ContentGlobal;
contentGlobal.__needleContentDispose?.();
const runtime = chrome.runtime;
const extensionId = runtime.id;
// A replacement isolated world cannot access the previous world's globals.
// A DOM event lets that world's listeners dispose themselves without a reload.
const replacementEvent = `needle:content-replaced:${extensionId}`;
window.dispatchEvent(new Event(replacementEvent));
for (const host of document.documentElement.querySelectorAll(`[data-needle-popup="${extensionId}"]`)) host.remove();
let current: Popup | null = null;
const shopping = createShoppingGate(enabled => { if (!enabled) dismiss(); });
void shopping.ready.catch(() => { dismiss(); });
const isX = /(^|\.)(x\.com|twitter\.com)$/.test(location.hostname);
const searchTips = ['Refine by color, style, or budget.', 'Prices keep their original currency.', 'Source links live in Product details.', 'A closer crop helps focus on one object.'];

function node<K extends keyof HTMLElementTagNameMap>(name: K, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(name);
  if (text) element.textContent = text;
  return element;
}
function send<T>(message: unknown): Promise<T> {
  const type = typeof message === 'object' && message !== null && 'type' in message ? message.type : '';
  if (type !== 'NEEDLE_OVERLAY_CANCEL' && type !== 'NEEDLE_OVERLAY_VOICE_CANCEL' && !shopping.isEnabled()) return Promise.reject(new Error('Needle is off. Turn it on in the side panel.'));
  try { return Promise.resolve(runtime.sendMessage(message)) as Promise<T>; }
  catch (error) { return Promise.reject(error); }
}
function connected(): boolean {
  try { return !!extensionId && runtime.id === extensionId; } catch { return false; }
}
function position(popup: Popup): void {
  // Reserve room for a question or result before anchoring. Content changes must
  // never move the controls away from the shopper's pointer.
  const gap = 20, width = Math.min(304, innerWidth - 16), reservedHeight = Math.min(360, innerHeight - 16);
  const rightFits = popup.pointerX + gap + width <= innerWidth - 8;
  const leftFits = popup.pointerX - gap - width >= 8;
  const left = rightFits ? popup.pointerX + gap : leftFits ? popup.pointerX - gap - width
    : Math.max(8, Math.min(popup.pointerX + gap, innerWidth - width - 8));
  let top = Math.max(8, Math.min(popup.pointerY + gap, innerHeight - reservedHeight - 8));
  let maxHeight = innerHeight - top - 8;
  if (!rightFits && !leftFits) {
    // Narrow pages use the space above or below the marker. Cap growth on that
    // side so a later question/result can never extend back over the glow.
    const below = Math.max(1, innerHeight - 8 - popup.pointerY - gap);
    const above = Math.max(1, popup.pointerY - gap - 8);
    if (below >= reservedHeight || below >= above) {
      top = popup.pointerY + gap; maxHeight = below;
    } else {
      maxHeight = Math.min(reservedHeight, above); top = popup.pointerY - gap - maxHeight;
    }
  }
  popup.host.style.setProperty('left', `${left}px`, 'important');
  popup.host.style.setProperty('top', `${top}px`, 'important');
  popup.host.style.setProperty('--needle-max-height', `${Math.max(1, maxHeight)}px`);
}
function dismiss(): void {
  const popup = current;
  if (!popup) return;
  current = null;
  popup.voice?.dispose();
  stopLoading(popup);
  popup.host.remove();
  if (connected()) void send({ type: 'NEEDLE_OVERLAY_CANCEL', requestId: popup.id }).catch(() => {});
}
function stopLoading(popup: Popup): void {
  if (popup.loadingTimer !== undefined) { clearInterval(popup.loadingTimer); popup.loadingTimer = undefined; }
  popup.loading.hidden = true;
  popup.targetSpot.hidden = true;
  popup.status.hidden = false;
}
function startLoading(popup: Popup): void {
  stopLoading(popup);
  popup.pending = true;
  popup.voice?.cancel(); updateVoiceControls(popup);
  popup.loading.hidden = false; popup.status.hidden = true;
  popup.targetSpot.hidden = false;
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
  updateVoiceControls(popup);
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
  popup.voice?.cancel(); updateVoiceControls(popup);
  popup.host.style.setProperty('visibility', 'visible', 'important');
  if (!response?.result || response.error) { fail(popup, response?.error || 'Needle could not reconnect. Right-click the item to try again.'); return; }
  popup.result = response.result;
  popup.offers.replaceChildren(); popup.offers.hidden = true;
  popup.variants.replaceChildren(); popup.variants.hidden = true;
  popup.details.hidden = true;
  popup.reply.remove();
  popup.answer.disabled = false; popup.answer.value = ''; popup.submit.disabled = true;
  if (response.imageDataUrl) imagePreview(popup, response.imageDataUrl);
  if (response.result.interpretation.needsClarification || !response.result.offers.length) {
    const question = response.result.interpretation.clarification || (response.result.interpretation.needsClarification
      ? 'Which object near your cursor would you like?'
      : searchRecoveryQuestion(response.result.interpretation));
    const webSearch = response.result.webSearch;
    popup.status.textContent = webSearch && (webSearch.status === 'failed' || webSearch.status === 'unavailable')
      ? `${webSearch.message} ${question}` : question;
    popup.panel.append(popup.reply);
    updateButtons(popup);
    return;
  }
  for (const offer of response.result.offers) { const option = node('option', offer.title); option.value = offer.id; popup.offers.append(option); }
  popup.offers.value = response.result.offers[0].id;
  popup.offers.hidden = response.result.offers.length < 2;
  renderOffer(popup);
}
function answerQuestion(popup: Popup): void {
  const answer = popup.answer.value.trim();
  if (current !== popup || popup.pending || !answer || !popup.result || (!popup.result.interpretation.needsClarification && popup.result.offers.length)) return;
  popup.answer.disabled = true; popup.submit.disabled = true;
  startLoading(popup); updateButtons(popup);
  void send<DiscoveryReply>({ type: 'NEEDLE_OVERLAY_CLARIFY', requestId: popup.id, answer })
    .then(response => showResponse(popup, response))
    .catch(() => fail(popup, 'Could not send your answer. Try again.'));
}
function updateVoiceControls(popup: Popup): void {
  const phase = popup.voiceState.phase;
  const active = phase !== 'idle';
  const label = phase === 'recording' ? 'Stop recording' : active ? 'Cancel voice' : 'Answer by voice';
  popup.record.setAttribute('aria-label', label);
  popup.record.setAttribute('title', active ? label : 'Answer by voice · audio sent to OpenAI');
  popup.record.setAttribute('aria-pressed', String(phase === 'recording'));
  popup.record.setAttribute('data-active', String(active));
  popup.record.disabled = popup.pending;
  popup.voiceStatus.textContent = popup.voiceState.message;
  popup.voiceStatus.hidden = !popup.voiceState.message;
}
function makePopup(target: ShoppingTarget, x: number, y: number): Popup {
  const host = node('div');
  host.setAttribute('data-needle-popup', extensionId);
  host.style.cssText = `position:fixed!important;left:${x}px!important;top:${y}px!important;right:auto!important;bottom:auto!important;z-index:2147483647!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;width:max-content!important;height:auto!important;max-width:calc(100vw - 16px)!important;visibility:visible!important;animation:none!important;transition:none!important;transform:none!important;`;
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = node('style');
  style.textContent = `
    :host{color-scheme:light}*{box-sizing:border-box}.panel{font:14px/1.4 "Segoe UI",Arial,sans-serif;color:#20242c;background:#fff;width:min(304px,calc(100vw - 16px));max-height:var(--needle-max-height,calc(100vh - 16px));overflow:auto;overscroll-behavior:contain;border:1px solid #dfe3eb;border-radius:16px;box-shadow:0 7px 28px #17242f2b;padding:7px}
    .actions{display:flex;gap:5px;position:sticky;top:0;background:#fff;z-index:1}button{font:600 13px "Segoe UI",Arial,sans-serif;border:0;border-radius:11px;min-height:40px;cursor:pointer;background:#f1f3f8;color:#20242c;padding:8px 14px;white-space:nowrap}.actions>button:first-child{background:#3156e8;color:#fff;flex:1}.actions>button:nth-child(2){flex:1.65}button:disabled{opacity:.5;cursor:default}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #8aafff;outline-offset:2px}.cancel{font-size:22px;min-width:40px;padding:4px 8px;background:transparent}
    .details{padding:12px 7px 2px}.head{display:flex;align-items:center;gap:10px}.head img{width:48px;height:48px;object-fit:cover;border-radius:8px;background:#f1f3f8}h2{font-size:14px;line-height:1.3;margin:0;font-weight:650;overflow-wrap:anywhere}.price{font-size:17px;font-weight:700;margin:5px 0 0}.status{font-size:12px;color:#6d7685;margin:8px 8px 4px;overflow-wrap:anywhere}
    select{font:13px "Segoe UI",Arial,sans-serif;width:calc(100% - 14px);padding:8px;border:1px solid #d8dfe8;border-radius:8px;background:#fff;color:#20242c;margin:8px 7px 1px}[hidden]{display:none!important}
    .cursor-target{position:fixed;z-index:2;pointer-events:none;width:6px;height:6px;border:1px solid #fff;border-radius:50%;background:#ff263e;transform:translate(-50%,-50%);box-shadow:0 0 3px #ff3548a6}
    .cursor-target:after{content:"";position:absolute;left:50%;top:50%;width:18px;height:18px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#ff3548cc 0%,#ff354866 35%,transparent 72%);animation:needle-target-glow 1.4s ease-in-out infinite}
    @keyframes needle-target-glow{0%,100%{opacity:.4}50%{opacity:1}}
    @media(prefers-reduced-motion:reduce){.cursor-target:after{animation:none;opacity:.85}}
    .reply{margin:12px 7px 6px}.reply label{display:block;font-size:11px;font-weight:600;color:#6d7685;margin:0 0 6px}.reply-row{display:flex;gap:6px}.reply input{min-width:0;flex:1;width:100%;font:13px "Segoe UI",Arial,sans-serif;padding:10px;border:1px solid #d8dfe8;border-radius:9px;background:#fff;color:#20242c}.reply button{background:#3156e8;color:white;padding:8px 12px}.reply input:disabled{background:#f7f9ff;color:#6d7685}
    .reply-input{position:relative;flex:1;min-width:0}.reply-input input{padding-right:38px}.reply .voice-mic{position:absolute;right:4px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:30px;min-height:30px;padding:0;border-radius:7px;background:transparent;color:#6d7685}.reply .voice-mic:hover{background:#edf1ff;color:#3156e8}.voice-mic svg{width:16px;height:16px}.voice-mic .voice-stop{display:none}.voice-mic[data-active=true] .voice-microphone{display:none}.voice-mic[data-active=true] .voice-stop{display:block}.reply .voice-mic[aria-pressed=true]{background:#fff0f1;color:#b72b3a}.voice-status{font-size:10px;line-height:1.5;margin:6px 0 0;color:#33446b}
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
  const status = node('p', 'Finding this item…'); status.className = 'status'; status.setAttribute('role', 'status');
  status.hidden = true;
  const loading = node('div'); loading.className = 'looking';
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
  const cancel = node('button', '×'); cancel.className = 'cancel'; cancel.type = 'button'; cancel.setAttribute('aria-label', 'Cancel');
  const reply = node('form'); reply.className = 'reply'; reply.setAttribute('aria-label', 'Answer Needle');
  const answerLabel = node('label', 'Your answer');
  const answer = node('input'); answer.type = 'text'; answer.maxLength = 1000; answer.required = true; answer.autocomplete = 'off'; answer.placeholder = 'e.g. The black instrument'; answer.setAttribute('aria-label', 'Your answer');
  const answerId = `needle-answer-${crypto.randomUUID()}`; answer.id = answerId; answerLabel.htmlFor = answerId;
  const submit = node('button', 'Search'); submit.type = 'submit'; submit.disabled = true;
  const record = node('button'); record.type = 'button'; record.className = 'voice-mic';
  record.setAttribute('aria-label', 'Answer by voice'); record.setAttribute('title', 'Answer by voice · audio sent to OpenAI');
  // Static icon markup only; product and page content never enter innerHTML.
  record.innerHTML = '<svg class="voice-microphone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg><svg class="voice-stop" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
  const replyInput = node('div'); replyInput.className = 'reply-input'; replyInput.append(answer, record);
  const replyRow = node('div'); replyRow.className = 'reply-row'; replyRow.append(replyInput, submit); reply.append(answerLabel, replyRow);
  const voiceStatus = node('p'); voiceStatus.className = 'voice-status'; voiceStatus.setAttribute('role', 'status'); voiceStatus.hidden = true;
  reply.append(voiceStatus);
  const targetSpot = node('span'); targetSpot.className = 'cursor-target'; targetSpot.hidden = true;
  targetSpot.setAttribute('data-needle-target', 'true'); targetSpot.setAttribute('aria-hidden', 'true');
  targetSpot.style.setProperty('left', `${x}px`); targetSpot.style.setProperty('top', `${y}px`);
  // A sibling of the scrollable panel keeps the glow at the clicked point. It
  // shares the host's capture visibility, so these pixels never enter the crop.
  actions.append(buy, cart, cancel); panel.append(actions, loading, details, status, offers, variants); shadow.append(style, panel, targetSpot); document.documentElement.append(host);
  // Chrome 114+: the top layer keeps the toolbar above fullscreen players and dialogs.
  try { host.setAttribute('popover', 'manual'); host.showPopover(); }
  catch { host.removeAttribute('popover'); }
  const popup: Popup = { id: crypto.randomUUID(), target, pointerX: x, pointerY: y, host, panel, details, status, title, price, image, offers, variants, buy, cart, added: false, loading, loadingTitle, loadingTip, loadingTime, reply, answer, submit, targetSpot, pending: false, record, voiceStatus, voiceState: { phase: 'idle', message: '' } };
  popup.voice = createVoiceSession({
    question: async () => {
      const value = await send<{ audioDataUrl?: string; error?: string }>({ type: 'NEEDLE_OVERLAY_SPEAK', requestId: popup.id });
      if (value.error || !value.audioDataUrl) throw new Error(value.error || 'The spoken question is unavailable.');
      return { audioDataUrl: value.audioDataUrl };
    },
    transcribe: async audioDataUrl => {
      const value = await send<{ text?: string; error?: string }>({ type: 'NEEDLE_OVERLAY_TRANSCRIBE', requestId: popup.id, audioDataUrl });
      if (value.error || !value.text) throw new Error(value.error || 'No speech was understood. Try again.');
      return { text: value.text };
    },
    cancel: () => { if (connected()) void send({ type: 'NEEDLE_OVERLAY_VOICE_CANCEL', requestId: popup.id }).catch(() => {}); },
  }, state => { popup.voiceState = state; updateVoiceControls(popup); }, transcript => {
    if (current !== popup || popup.pending) return;
    answer.value = transcript; submit.disabled = false;
  });
  position(popup);
  startLoading(popup);
  offers.addEventListener('change', () => renderOffer(popup));
  variants.addEventListener('change', () => { popup.added = false; popup.cart.textContent = 'Add to cart'; updateButtons(popup); });
  cancel.addEventListener('click', dismiss);
  answer.addEventListener('input', () => { popup.voice?.cancel(); submit.disabled = popup.pending || !answer.value.trim(); });
  record.addEventListener('click', () => { if (popup.pending) return; if (popup.voiceState.phase === 'recording') popup.voice?.stopRecording(); else if (popup.voiceState.phase !== 'idle') popup.voice?.cancel(); else void popup.voice?.record(); });
  for (const type of ['keydown', 'keyup']) reply.addEventListener(type, event => event.stopPropagation());
  reply.addEventListener('submit', event => { event.preventDefault(); answerQuestion(popup); });
  for (const [button, type] of [[buy, 'NEEDLE_OVERLAY_BUY'], [cart, 'NEEDLE_OVERLAY_CART']] as const) {
    button.addEventListener('click', () => {
      const offer = chosen(popup);
      if (!offer) return;
      buy.disabled = true; cart.disabled = true;
      void send<{ error?: string }>({ type, requestId: popup.id, offerId: offer.id, variant: variants.value || undefined }).then(response => {
        if (current !== popup) return;
        if (!response || response.error) { popup.status.textContent = response?.error || 'The action could not be confirmed. Check your cart or right-click again.'; updateButtons(popup); return; }
        if (type === 'NEEDLE_OVERLAY_BUY') { dismiss(); return; }
        popup.added = true; cart.textContent = 'Added'; popup.status.textContent = 'Saved to your cart.'; updateButtons(popup);
      }).catch(() => { if (current === popup) { popup.status.textContent = 'The action could not be confirmed. Check your cart or right-click again.'; updateButtons(popup); } });
    });
  }
  return popup;
}

// Old isolated worlds can outlive an extension reload; yield to the new listener.
function onContextMenu(event: MouseEvent): void {
  if (!shopping.isEnabled() || !connected() || !event.isTrusted || event.shiftKey || (current && event.composedPath().includes(current.host))) return;
  const target = targetAt(event);
  if (!target) return;
  event.preventDefault(); event.stopImmediatePropagation();
  dismiss();
  const popup = makePopup(target, event.clientX, event.clientY);
  current = popup;
  void discover(popup);
}
async function discover(popup: Popup): Promise<void> {
  // A worker wake-up or dropped message channel is not an invalidated page.
  // Retry discovery only; the worker reuses this request's captured frame/result.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (current !== popup || !shopping.isEnabled()) return;
    if (!connected()) { dismiss(); return; }
    let response: DiscoveryReply | undefined;
    try { response = await send<DiscoveryReply>({ type: 'NEEDLE_OVERLAY_DISCOVER', requestId: popup.id }); }
    catch { /* A lost channel can recover once while this selection is current. */ }
    if (current !== popup || !shopping.isEnabled()) return;
    if (!connected()) { dismiss(); return; }
    if (response?.result || response?.error) { showResponse(popup, response); return; }
    if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 200));
  }
  showResponse(popup, undefined);
}
function imagePreview(popup: Popup, source: string): void { if (/^data:image\/jpeg;base64,/.test(source)) { popup.image.src = source; popup.image.hidden = false; } }

function onKeyDown(event: KeyboardEvent): void { if (event.key === 'Escape' && current) { event.stopImmediatePropagation(); dismiss(); } }
function onPointerDown(event: PointerEvent): void { if (current && !event.composedPath().includes(current.host)) dismiss(); }
function onResize(): void { if (current) position(current); }
const onMessage: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, sender, respond) => {
  const popup = current;
  if (!connected() || sender.id !== extensionId || !popup || message?.requestId !== popup.id) return;
  if (message.type === 'NEEDLE_CAPTURE_FINISHED') { popup.host.style.setProperty('visibility', 'visible', 'important'); respond({ ok: true }); return; }
  if (!['NEEDLE_PREPARE_CAPTURE', 'NEEDLE_VALIDATE_CAPTURE'].includes(message.type)) return;
  const prepare = () => {
    if (!shopping.isEnabled() || current !== popup) { respond({ error: 'Selection cancelled' }); return; }
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
runtime.onMessage.addListener(onMessage);
window.addEventListener(replacementEvent, dispose);
function dispose(): void {
  dismiss();
  shopping.dispose();
  window.removeEventListener('contextmenu', onContextMenu, { capture: true });
  window.removeEventListener('keydown', onKeyDown, { capture: true });
  window.removeEventListener('pointerdown', onPointerDown, { capture: true });
  window.removeEventListener('pagehide', dismiss);
  window.removeEventListener('resize', onResize);
  window.removeEventListener(replacementEvent, dispose);
  try { runtime.onMessage.removeListener(onMessage); } catch { /* Previous extension context was invalidated. */ }
}
contentGlobal.__needleContentDispose = dispose;
