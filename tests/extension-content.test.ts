import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mediaCrop } from '../src/extension/geometry';
import { targetAt, targetGeometry, targetText } from '../src/extension/target';

// A small DOM contract harness: actual content-script listeners run against controllable
// geometry and message timing. Browser screenshots cover native rendering separately.
class Style {
  private values = new Map<string, string>();
  set cssText(value: string) {
    for (const declaration of value.split(';')) {
      const [key, raw] = declaration.split(':');
      if (key && raw) this.values.set(key.trim(), raw.replace(/!important/g, '').trim());
    }
  }
  setProperty(key: string, value: string) { this.values.set(key, value); }
  get visibility() { return this.values.get('visibility'); }
  get left() { return this.values.get('left'); }
  get top() { return this.values.get('top'); }
  getPropertyValue(key: string) { return this.values.get(key); }
}
class FakeElement {
  parentElement: FakeElement | null = null;
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  listeners = new Map<string, Set<(...args: any[]) => void>>();
  style = new Style();
  shadow?: FakeElement;
  textContent = ''; hidden = false; disabled = false; className = ''; value = ''; type = ''; alt = ''; src = '';
  isConnected = true; popoverOpen = false; backgroundImage = 'none';
  box = { x: 100, y: 100, width: 400, height: 300 };
  constructor(public tagName: string) { this.tagName = tagName.toLowerCase(); }
  getBoundingClientRect() { return { ...this.box, left: this.box.x, top: this.box.y, right: this.box.x + this.box.width, bottom: this.box.y + this.box.height }; }
  matches(selectors: string): boolean {
    return selectors.split(',').some(raw => {
      const selector = raw.trim();
      if (selector === '[contenteditable]:not([contenteditable="false"])') return this.attributes.has('contenteditable') && this.attributes.get('contenteditable') !== 'false';
      const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
      return attr ? this.attributes.get(attr[1]) === attr[2] : this.tagName === selector;
    });
  }
  closest(selectors: string): FakeElement | null { return this.matches(selectors) ? this : this.parentElement?.closest(selectors) ?? null; }
  querySelectorAll(selectors: string): FakeElement[] { return this.children.flatMap(child => [...(child.matches(selectors) ? [child] : []), ...child.querySelectorAll(selectors)]); }
  querySelector(selectors: string): FakeElement | null { return this.querySelectorAll(selectors)[0] ?? null; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  getAttribute(key: string) { return this.attributes.get(key) ?? null; }
  removeAttribute(key: string) { this.attributes.delete(key); }
  attachShadow() { this.shadow = new FakeElement('shadow-root'); return this.shadow; }
  showPopover() { this.popoverOpen = true; }
  append(...children: FakeElement[]) {
    for (const child of children) { child.parentElement = this; this.children.push(child); }
    if (this.tagName === 'select' && this.children.length === children.length) this.value = this.children[0]?.value ?? '';
  }
  replaceChildren(...children: FakeElement[]) { this.children = []; this.value = ''; this.append(...children); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.isConnected = false; }
  addEventListener(type: string, fn: (...args: any[]) => void) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(fn); }
  removeEventListener(type: string, fn: (...args: any[]) => void) { this.listeners.get(type)?.delete(fn); }
  emit(type: string, value: unknown = {}) { for (const fn of this.listeners.get(type) ?? []) fn(value); }
}
const asElement = (value: FakeElement) => value as unknown as Element;
const extensionId = 'a'.repeat(32);
let root: FakeElement;
let windowEvents: FakeElement;
let hits: FakeElement[];
let runtimeEvents: Set<(...args: any[]) => unknown>;
let runtime: any;
let finishDiscovery: (value: unknown) => void;
let sendMessage: ReturnType<typeof vi.fn>;
function click(target: FakeElement, extra: Record<string, unknown> = {}) {
  const path: FakeElement[] = [];
  for (let parent: FakeElement | null = target; parent; parent = parent.parentElement) path.push(parent);
  return { target, clientX: 200, clientY: 200, composedPath: () => path, isTrusted: true, shiftKey: false, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), ...extra } as unknown as MouseEvent;
}
function popup() { return root.children.find(child => !!child.shadow)!; }
function targetMarker(host = popup()) { return host.shadow!.querySelector('[data-needle-target="true"]')!; }
function contentMessage(type: string, requestId: string) {
  return new Promise<any>(resolve => { for (const listener of runtimeEvents) listener({ type, requestId }, { id: extensionId }, resolve); });
}
function searchResult(needsClarification = false) {
  return {
    sessionId: 'test-session', mode: 'sample',
    interpretation: { name: 'Black instrument', productType: 'mandolin', needsClarification, clarification: needsClarification ? 'Do you mean the black instrument or the shirt?' : null },
    offers: needsClarification ? [] : [{ id: 'mandolin', title: 'Black F-style mandolin', price: 249, currency: 'USD', match: 'similar', variants: ['Black'], sourceUrl: 'https://example.com/mandolin', referenceUrl: null, dataOrigin: 'sample' }],
    warnings: [],
  };
}
beforeEach(() => {
  vi.resetModules(); root = new FakeElement('html'); windowEvents = new FakeElement('window'); hits = []; runtimeEvents = new Set();
  sendMessage = vi.fn((message: { type: string }) => message.type === 'NEEDLE_OVERLAY_DISCOVER' ? new Promise(resolve => { finishDiscovery = resolve; }) : Promise.resolve({ ok: true }));
  runtime = { id: extensionId, sendMessage, onMessage: { addListener: (listener: (...args: any[]) => unknown) => runtimeEvents.add(listener), removeListener: (listener: (...args: any[]) => unknown) => runtimeEvents.delete(listener) } };
  vi.stubGlobal('Element', FakeElement);
  vi.stubGlobal('document', { documentElement: root, createElement: (tag: string) => new FakeElement(tag), elementsFromPoint: () => hits });
  vi.stubGlobal('window', windowEvents);
  vi.stubGlobal('location', { hostname: 'example.com' });
  vi.stubGlobal('innerWidth', 1280); vi.stubGlobal('innerHeight', 720); vi.stubGlobal('scrollX', 0); vi.stubGlobal('scrollY', 0);
  vi.stubGlobal('getComputedStyle', (element: FakeElement) => ({ backgroundImage: element.backgroundImage }));
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => { queueMicrotask(fn); return 1; });
  vi.stubGlobal('chrome', { runtime });
});
afterEach(() => {
  const state = globalThis as typeof globalThis & { __needleContentDispose?: () => void };
  state.__needleContentDispose?.(); delete state.__needleContentDispose;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('right-click target selection', () => {
  it('uses a bounded viewport crop when the clicked area is a generic page element', () => {
    const div = new FakeElement('div'); hits = [div];
    const target = targetAt(click(div));
    expect(target).toEqual({ kind: 'viewport', element: null });
    expect(mediaCrop(targetGeometry(target!, 200, 200))).toMatchObject({ x: 40, y: 40, width: 320, height: 320 });
    expect(targetText(target!, true)).toEqual({});
  });
  it('finds video underneath a generic player controls layer without an X-specific selector', () => {
    const player = new FakeElement('section'), controls = new FakeElement('div'), video = new FakeElement('video');
    player.append(video, controls); hits = [controls];
    expect(targetAt(click(controls))?.element).toBe(video);
  });
  it('recognizes CSS background artwork and canvas media', () => {
    const cover = new FakeElement('div'); cover.backgroundImage = 'url("cover.jpg")'; hits = [cover];
    expect(targetAt(click(cover))).toEqual({ kind: 'media', element: cover });
    const canvas = new FakeElement('canvas'); hits = [canvas];
    expect(targetAt(click(canvas))?.element).toBe(canvas);
  });
  it('keeps native editing menus inside form and contenteditable controls', () => {
    for (const tag of ['input', 'textarea', 'select']) expect(targetAt(click(new FakeElement(tag)))).toBeNull();
    const editor = new FakeElement('div'), child = new FakeElement('span'); editor.setAttribute('contenteditable', ''); editor.append(child);
    expect(targetAt(click(child))).toBeNull();
  });
  it('never substitutes nearby unrelated media outside the clicked coordinates', () => {
    const section = new FakeElement('section'), text = new FakeElement('div'), image = new FakeElement('img');
    image.box.x = 800; section.append(text, image); hits = [text];
    expect(targetAt(click(text))?.kind).toBe('viewport');
  });
});

describe('content-script action toolbar', () => {
  it('shows exactly Buy, Add to cart, and × immediately while discovery is pending', async () => {
    await import('../src/extension/content');
    const event = click(new FakeElement('div')); windowEvents.emit('contextmenu', event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(popup().style.visibility).toBe('visible');
    expect(popup().popoverOpen).toBe(true);
    const buttons = popup().shadow!.querySelectorAll('button');
    expect(buttons.map(button => button.textContent)).toEqual(['Buy', 'Add to cart', '×']);
    expect(buttons.map(button => button.disabled)).toEqual([true, true, false]);
    expect(targetMarker().hidden).toBe(false);
    expect(targetMarker().getAttribute('aria-hidden')).toBe('true');
    expect([targetMarker().style.left, targetMarker().style.top]).toEqual(['200px', '200px']);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'NEEDLE_OVERLAY_DISCOVER' }));
  });
  it('hides the toolbar only during screenshot preparation and keeps its crop bounded', async () => {
    await import('../src/extension/content'); windowEvents.emit('contextmenu', click(new FakeElement('div')));
    const requestId = sendMessage.mock.calls[0][0].requestId;
    const preparation = contentMessage('NEEDLE_PREPARE_CAPTURE', requestId);
    expect(popup().style.visibility).toBe('hidden');
    // The marker shares the hidden host, keeping it out of the captured pixels.
    expect(popup().shadow!.children).toContain(targetMarker());
    const response = await preparation;
    expect(mediaCrop(response.geometry)).toMatchObject({ width: 320, height: 320 });
    await contentMessage('NEEDLE_CAPTURE_FINISHED', requestId);
    expect(popup().style.visibility).toBe('visible');
    expect(targetMarker().hidden).toBe(false);
  });
  it('cancels before discovery completes and ignores late results', async () => {
    await import('../src/extension/content'); windowEvents.emit('contextmenu', click(new FakeElement('div')));
    const marker = targetMarker();
    popup().shadow!.querySelectorAll('button')[2].emit('click');
    expect(marker.hidden).toBe(true);
    expect(root.children).toHaveLength(0);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'NEEDLE_OVERLAY_CANCEL' }));
    finishDiscovery({ result: { offers: [], interpretation: {} } });
    await Promise.resolve(); expect(root.children).toHaveLength(0);
  });
  it('leaves the native menu untouched for Shift, editable fields, untrusted events, and invalidated contexts', async () => {
    await import('../src/extension/content');
    const shift = click(new FakeElement('div'), { shiftKey: true });
    const synthetic = click(new FakeElement('div'), { isTrusted: false });
    const editable = click(new FakeElement('input'));
    for (const event of [shift, synthetic, editable]) { windowEvents.emit('contextmenu', event); expect(event.preventDefault).not.toHaveBeenCalled(); }
    runtime.id = undefined;
    const orphan = click(new FakeElement('div')); windowEvents.emit('contextmenu', orphan);
    expect(orphan.preventDefault).not.toHaveBeenCalled(); expect(sendMessage).not.toHaveBeenCalled();
  });
  it('re-injection replaces earlier listeners instead of triggering duplicate searches', async () => {
    await import('../src/extension/content'); vi.resetModules(); await import('../src/extension/content');
    windowEvents.emit('contextmenu', click(new FakeElement('div')));
    expect(sendMessage).toHaveBeenCalledTimes(1); expect(runtimeEvents.size).toBe(1);
  });
  it('answers a clarification in the same popup and retains the original selected preview', async () => {
    await import('../src/extension/content'); windowEvents.emit('contextmenu', click(new FakeElement('div')));
    const requestId = sendMessage.mock.calls[0][0].requestId;
    finishDiscovery({ result: searchResult(true), imageDataUrl: 'data:image/jpeg;base64,b3JpZ2luYWw=' });
    await Promise.resolve();
    const host = popup(), form = host.shadow!.querySelector('form')!, input = form.querySelector('input')!;
    expect(form).toBeTruthy();
    expect(form.querySelectorAll('button').map(button => button.getAttribute('aria-label') || button.textContent)).toEqual(['Answer by voice', 'Search']);
    expect(targetMarker(host).hidden).toBe(true);
    input.value = 'The black instrument on the wall'; input.emit('input');
    let finishAnswer!: (value: unknown) => void;
    sendMessage.mockImplementationOnce(() => new Promise(resolve => { finishAnswer = resolve; }));
    const event = { preventDefault: vi.fn() }; form.emit('submit', event); form.emit('submit', event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(sendMessage.mock.calls.filter(([message]) => message.type === 'NEEDLE_OVERLAY_CLARIFY')).toEqual([[{ type: 'NEEDLE_OVERLAY_CLARIFY', requestId, answer: 'The black instrument on the wall' }]]);
    expect(input.disabled).toBe(true);
    expect(targetMarker(host).hidden).toBe(false);
    finishAnswer({ result: searchResult() }); await Promise.resolve();
    expect(popup()).toBe(host);
    expect(host.shadow!.querySelector('form')).toBeNull();
    expect(host.shadow!.querySelector('img')!.src).toBe('data:image/jpeg;base64,b3JpZ2luYWw=');
    expect(host.shadow!.querySelector('h2')!.textContent).toBe('Black F-style mandolin');
    expect(host.shadow!.querySelectorAll('button')[0].disabled).toBe(false);
    expect(targetMarker(host).hidden).toBe(true);
  });
  it('keeps the question and typed answer when microphone access is unavailable', async () => {
    await import('../src/extension/content'); windowEvents.emit('contextmenu', click(new FakeElement('div')));
    finishDiscovery({ result: searchResult(true) }); await Promise.resolve();
    const form = popup().shadow!.querySelector('form')!, input = form.querySelector('input')!;
    input.value = 'The instrument on the left'; input.emit('input');
    form.querySelector('[aria-label="Answer by voice"]')!.emit('click');
    await Promise.resolve();
    expect(input.value).toBe('The instrument on the left');
    expect(form.querySelectorAll('p').some(p => p.textContent.includes('Type your answer'))).toBe(true);
    expect(popup().shadow!.querySelectorAll('p').some(p => p.textContent === 'Do you mean the black instrument or the shirt?')).toBe(true);
    expect(sendMessage.mock.calls.some(([message]) => message.type === 'NEEDLE_OVERLAY_CLARIFY')).toBe(false);
  });
  it('preserves an answer for retry after a failed clarification and ignores completion after cancellation', async () => {
    await import('../src/extension/content'); windowEvents.emit('contextmenu', click(new FakeElement('div')));
    finishDiscovery({ result: searchResult(true) }); await Promise.resolve();
    const host = popup(), form = host.shadow!.querySelector('form')!, input = form.querySelector('input')!;
    input.value = 'The instrument'; input.emit('input');
    sendMessage.mockResolvedValueOnce({ error: 'Please retry.' });
    form.emit('submit', { preventDefault: vi.fn() }); await Promise.resolve();
    expect(input.value).toBe('The instrument'); expect(input.disabled).toBe(false);
    expect(form.querySelectorAll('button').find(button => button.type === 'submit')!.disabled).toBe(false);
    expect(targetMarker(host).hidden).toBe(true);
    let finishAnswer!: (value: unknown) => void;
    sendMessage.mockImplementationOnce(() => new Promise(resolve => { finishAnswer = resolve; }));
    form.emit('submit', { preventDefault: vi.fn() });
    expect(targetMarker(host).hidden).toBe(false);
    host.shadow!.querySelectorAll('button')[2].emit('click');
    expect(targetMarker(host).hidden).toBe(true);
    finishAnswer({ result: searchResult() }); await Promise.resolve();
    expect(root.children).toHaveLength(0);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'NEEDLE_OVERLAY_CANCEL' }));
  });
  it.each([
    { width: 1280, x: 1250, y: 690, left: 926, top: 352, maxHeight: 360 },
    { width: 360, x: 180, y: 300, left: 48, top: 320, maxHeight: 392 },
    { width: 360, x: 180, y: 500, left: 48, top: 120, maxHeight: 360 },
  ])('keeps the popup clear of the cursor and stable as content grows at $width px / $x,$y', async ({ width, x, y, left, top, maxHeight }) => {
    vi.useFakeTimers();
    vi.stubGlobal('innerWidth', width);
    await import('../src/extension/content'); windowEvents.emit('contextmenu', click(new FakeElement('div'), { clientX: x, clientY: y }));
    const host = popup(), anchor = [host.style.left, host.style.top];
    expect(anchor).toEqual([`${left}px`, `${top}px`]);
    expect(host.style.getPropertyValue('--needle-max-height')).toBe(`${maxHeight}px`);
    const marker = targetMarker(host);
    expect([marker.style.left, marker.style.top]).toEqual([`${x}px`, `${y}px`]);
    host.box.height = 120; vi.advanceTimersByTime(15000);
    expect([host.style.left, host.style.top]).toEqual(anchor);
    expect([marker.style.left, marker.style.top]).toEqual([`${x}px`, `${y}px`]);
    finishDiscovery({ result: searchResult(true) }); await Promise.resolve();
    host.box.height = 310;
    expect([host.style.left, host.style.top]).toEqual(anchor);
    const form = host.shadow!.querySelector('form')!, input = form.querySelector('input')!;
    input.value = 'The instrument'; input.emit('input');
    sendMessage.mockResolvedValueOnce({ result: searchResult() });
    form.emit('submit', { preventDefault: vi.fn() }); await Promise.resolve();
    expect([host.style.left, host.style.top]).toEqual(anchor);
  });
});
