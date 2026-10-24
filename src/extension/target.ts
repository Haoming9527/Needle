import type { MediaGeometry } from './geometry';

export interface ShoppingTarget { element: Element | null; kind: 'media' | 'viewport'; contextElement?: Element }
const visualSelector = 'video,img,canvas,svg';
const editableSelector = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
const playerSelector = '[data-testid="videoPlayer"],[data-testid="videoComponent"],[data-testid="tweetPhoto"],[data-testid="videoPlayerContainer"]';

function containsPoint(element: Element, x: number, y: number): boolean {
  const box = element.getBoundingClientRect();
  return box.width >= 24 && box.height >= 24 && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}
function visual(element: Element): boolean { return element.matches(visualSelector); }

/** Resolve a visible object without reading page-wide text or fetching its image URL. */
export function targetAt(event: MouseEvent): ShoppingTarget | null {
  const path = event.composedPath().filter((item): item is Element => item instanceof Element);
  const target = path[0] ?? (event.target instanceof Element ? event.target : null);
  if (!target || path.some(element => element.closest(editableSelector))) return null;
  const { clientX: x, clientY: y } = event;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > innerWidth || y > innerHeight) return null;
  const visible = (element: Element) => containsPoint(element, x, y);
  const direct = path.find(element => visual(element) && visible(element));
  if (direct) return { element: direct, kind: 'media' };

  // Transparent controls can receive the event while the image/video is below them.
  const hits = document.elementsFromPoint(x, y);
  const underneath = hits.find(element => visual(element) && visible(element));
  if (underneath) return { element: underneath, kind: 'media' };
  const player = target.closest(playerSelector);
  if (player) {
    const media = Array.from(player.querySelectorAll(visualSelector)).find(visible);
    if (media) return { element: media, kind: 'media' };
  }
  // Different players use different wrapper names. Search only local ancestors and require
  // every candidate to occupy the clicked coordinates; never scan a whole feed.
  let ancestor: Element | null = target;
  for (let depth = 0; ancestor && depth < 5 && !ancestor.matches('html,body'); depth++, ancestor = ancestor.parentElement) {
    const media = Array.from(ancestor.querySelectorAll(visualSelector)).slice(0, 100).find(visible);
    if (media) return { element: media, kind: 'media' };
  }
  const background = hits.find(element => visible(element) && getComputedStyle(element).backgroundImage !== 'none');
  if (background) return { element: background, kind: 'media' };

  // CSS compositions and inaccessible shadow trees still get the requested menu. Only a
  // small cursor-centred screenshot is sent, never page-wide text.
  return { element: null, kind: 'viewport' };
}

export function targetGeometry(target: ShoppingTarget, pointerX: number, pointerY: number): MediaGeometry {
  if (target.element && !target.element.isConnected) throw new Error('The selected object is no longer visible.');
  const box = target.element?.getBoundingClientRect();
  return {
    x: box?.x ?? 0, y: box?.y ?? 0, width: box?.width ?? innerWidth, height: box?.height ?? innerHeight,
    pointerX, pointerY, viewportWidth: innerWidth, viewportHeight: innerHeight, scrollX, scrollY,
  };
}

export function targetText(target: ShoppingTarget, onX: boolean): { text?: string; context?: string } {
  const element = target.element ?? target.contextElement;
  if (!element) return {};
  if (element.closest(editableSelector)) return {};
  const text = element.matches('img') ? element.getAttribute('alt') || element.getAttribute('title') : element.matches('video') ? element.getAttribute('aria-label') : element.matches('p,h1,h2,h3,figcaption') ? element.textContent : null;
  const container = element.closest('figure,article,section');
  const context = onX ? element.closest('article')?.querySelector('[data-testid="tweetText"]')?.textContent : container?.querySelector('figcaption,h1,h2,h3')?.textContent;
  return { text: text?.slice(0, 400) || undefined, context: context?.slice(0, 600) || undefined };
}
