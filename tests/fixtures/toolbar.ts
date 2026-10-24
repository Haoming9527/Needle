import type { Offer, SearchResponse } from '../../shared/types';
import type { MediaGeometry } from '../../src/extension/geometry';

// This fixture replaces only the page-world runtime bridge. The content script
// stays unchanged, and all right-clicks must be real browser input (isTrusted).
type Message = { type?: string; requestId?: string; offerId?: string; variant?: string; answer?: string };
type Reply = { geometry?: MediaGeometry; text?: string; context?: string; error?: string };
type Listener = (message: Message, sender: { id: string }, respond: (value: Reply) => void) => unknown;
const runtimeId = 'a'.repeat(32);
const listeners = new Set<Listener>();
const counts = { discover: 0, clarify: 0, cart: 0, buy: 0, cancel: 0, siteMenu: 0 };
const askQuestion = new URLSearchParams(location.search).has('clarify');
const emptyMatches = new URLSearchParams(location.search).has('empty');
const dropFirstReply = new URLSearchParams(location.search).has('disconnect');
const searchDelay = new URLSearchParams(location.search).has('loading') ? 30_000 : 800;
const cancelled = new Set<string>();
const selections = new Map<string, SearchResponse>();
const status = document.getElementById('bridge-status')!;
const detail = document.getElementById('bridge-detail')!;
const counter = document.getElementById('bridge-counts')!;
function count() { counter.textContent = `Discover: ${counts.discover} · Clarify: ${counts.clarify} · Cart: ${counts.cart} · Buy: ${counts.buy} · Cancel: ${counts.cancel} · Site menu: ${counts.siteMenu}`; }
function report(message: string, data?: unknown) { status.textContent = message; if (data !== undefined) detail.textContent = JSON.stringify(data, null, 2); count(); }
function emit(type: string, requestId: string): Promise<Reply> {
  return new Promise(resolve => {
    const timeout = window.setTimeout(() => resolve({ error: 'The content script did not answer the fixture bridge.' }), 2000);
    const respond = (value: Reply) => { clearTimeout(timeout); resolve(value); };
    for (const listener of listeners) listener({ type, requestId }, { id: runtimeId }, respond);
  });
}
function sample(text = ''): SearchResponse {
  const microphone = /mic/i.test(text);
  const title = microphone ? 'Shure MV7+ microphone' : 'Sony WH-1000XM5 headphones';
  const offer: Offer = {
    id: microphone ? 'fixture-microphone' : 'fixture-headphones', title,
    description: microphone ? 'USB-C and XLR microphone' : 'Wireless noise-cancelling headphones',
    imageUrl: null, sourceUrl: null, match: 'similar', matchEvidence: 'Fixture response only.',
    price: microphone ? 389000 : 329000, currency: 'KRW', observedAt: '2026-10-25T00:00:00.000Z', dataOrigin: 'sample',
    variants: microphone ? ['Black', 'White'] : ['Black'], shipping: null, availability: null, returns: null,
    reason: 'Prepared fixture recommendation.', differences: [],
  };
  return {
    sessionId: crypto.randomUUID(), mode: 'sample', agentMode: 'catalog',
    interpretation: { name: title, productType: microphone ? 'microphone' : 'headphones', brand: null, model: null, color: null, attributes: [], queries: [title], needsClarification: false, clarification: null },
    offers: [offer], warnings: ['Mock bridge response.'],
  };
}
async function sendMessage(message: Message): Promise<unknown> {
  const id = message.requestId ?? '';
  if (message.type === 'NEEDLE_OVERLAY_CANCEL') {
    counts.cancel++; cancelled.add(id); selections.delete(id); report('Cancelled through the actual popup.'); return { ok: true };
  }
  if (message.type === 'NEEDLE_OVERLAY_DISCOVER') {
    counts.discover++; report('Gesture received. Preparing the selected area…');
    const previous = selections.get(id);
    if (previous) {
      report('Recovered the dropped reply using the same selection. No second capture.', { requestId: id });
      return { result: previous };
    }
    const prepared = await emit('NEEDLE_PREPARE_CAPTURE', id);
    await emit('NEEDLE_CAPTURE_FINISHED', id);
    if (prepared.error) { report(prepared.error); return prepared; }
    report('Mock result pending. The three controls should already be visible.', { text: prepared.text ?? null, geometry: prepared.geometry });
    await new Promise(resolve => window.setTimeout(resolve, searchDelay));
    if (cancelled.has(id)) return { error: 'Cancelled.' };
    const result = sample(prepared.text);
    if (askQuestion) {
      result.interpretation.needsClarification = true;
      result.interpretation.clarification = 'Do you mean the microphone or the headphones near your cursor?';
      result.offers = [];
    }
    if (emptyMatches) {
      result.offers = [];
      result.decision = { status: 'no_match' };
      result.webSearch = { status: 'used', message: 'Products were found, but none was a suitable match for your selection.' };
    }
    selections.set(id, result);
    if (dropFirstReply) {
      report('Simulated a dropped runtime reply after discovery completed.', { requestId: id });
      return undefined;
    }
    report('Prepared result delivered. No network calls or captures occurred.', { text: prepared.text ?? null, geometry: prepared.geometry, variants: result.offers[0]?.variants });
    return { result };
  }
  if (message.type === 'NEEDLE_OVERLAY_CLARIFY') {
    const previous = selections.get(id);
    if (!previous || (!previous.interpretation.needsClarification && previous.offers.length) || !message.answer?.trim()) return { error: 'Answer the current fixture question.' };
    counts.clarify++; report('Answer received. Reusing the original selection; no new capture.', { requestId: id, answer: message.answer });
    await new Promise(resolve => window.setTimeout(resolve, 1200));
    if (cancelled.has(id)) return { error: 'Cancelled.' };
    const result = sample(message.answer);
    selections.set(id, result);
    report('Clarification resolved through the actual popup. This is a mock result.', { requestId: id, answer: message.answer, name: result.interpretation.name });
    return { result };
  }
  if (message.type === 'NEEDLE_OVERLAY_CART' || message.type === 'NEEDLE_OVERLAY_BUY') {
    const offer = selections.get(id)?.offers.find(item => item.id === message.offerId);
    if (!offer) return { error: 'Fixture selection expired.' };
    if (offer.variants.length > 1 && !message.variant) return { error: 'Choose a variant.' };
    if (message.variant && !offer.variants.includes(message.variant)) return { error: 'Unknown fixture variant.' };
    if (message.type === 'NEEDLE_OVERLAY_CART') counts.cart++; else counts.buy++;
    report(message.type === 'NEEDLE_OVERLAY_CART' ? 'Add to cart reached the mock bridge.' : 'Buy reached the mock bridge; no side panel opened.', { offerId: offer.id, variant: message.variant });
    return { ok: true };
  }
  return { error: 'Unsupported fixture message.' };
}

const { preferenceStorage } = await import('./preference-storage');
const existingChrome = (globalThis as { chrome?: typeof chrome }).chrome;
if (existingChrome?.runtime?.id) {
  report('A real extension runtime exists here. Fixture bridge was not installed.');
} else {
  // Test-only instrumentation lets browser accessibility/locator tools inspect
  // the popup. Match the authored Needle host rather than opening every shadow
  // root; production content.ts still creates a closed root without this shim.
  const attachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (this: Element, init: ShadowRootInit): ShadowRoot {
    const needleHost = this instanceof HTMLDivElement && init.mode === 'closed'
      && this.style.position === 'fixed' && this.style.zIndex === '2147483647';
    return attachShadow.call(this, needleHost ? { ...init, mode: 'open' } : init);
  };
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: {
    ...existingChrome,
    storage: preferenceStorage(),
    runtime: {
      id: runtimeId, getManifest: () => ({ version: '0.4.0-fixture' }), sendMessage,
      onMessage: { addListener: (listener: Listener) => listeners.add(listener), removeListener: (listener: Listener) => listeners.delete(listener) },
    },
  } });
  await import('../../src/extension/content');
  report('Mock bridge ready. Right-click a surface above.');
}

for (const target of document.querySelectorAll('.layered')) {
  target.addEventListener('contextmenu', event => {
    counts.siteMenu++;
    document.getElementById('site-menu')!.hidden = false;
    report('The site menu handler received the context-menu event.');
    // Real sites often prevent the browser menu; Needle should run before this.
    if (!(event as MouseEvent).shiftKey) event.preventDefault();
  });
}
document.addEventListener('pointerdown', () => { document.getElementById('site-menu')!.hidden = true; });
const canvas = document.getElementById('canvas-target') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
const lamp = new Image();
lamp.onload = () => { if (ctx) { ctx.fillStyle = '#edf2f8'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(lamp, 0, 0, canvas.width, canvas.height); } };
lamp.src = '/assets/photos/lamp.png';
