import { ATTENTION_DWELL_MS } from "../../shared/attention";

export interface AttentionMeasurement {
  action: "dwell" | "revisit";
  dwellMs: number;
  visitOrdinal: number;
}
interface AttentionCollectorOptions {
  document: Document;
  targetId: string;
  onObservation: (measurement: AttentionMeasurement) => void;
  onTracking?: (tracking: boolean) => void;
  initialVisitOrdinal?: number;
}
const REVISIT_AWAY_MS = 750;
const excluded =
  'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[data-needle-overlay],[data-needle-attention-ignore]';

/** Measures only a registered region; never reads content, captures pixels, or retains pointer coordinates. */
export function mountAttentionCollector(
  options: AttentionCollectorOptions,
): () => void {
  const doc = options.document;
  let current: Element | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let startedAt = 0;
  let awayAt: number | null = null;
  let ordinal = Math.max(0, Math.floor(options.initialVisitOrdinal ?? 0));
  let tracking = false;
  let disposed = false;
  const available = () =>
    !disposed && doc.visibilityState === "visible" && doc.hasFocus();
  function setTracking(next: boolean) {
    if (tracking === next) return;
    tracking = next;
    options.onTracking?.(next);
  }
  function cancelTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    setTracking(false);
  }
  function leave() {
    if (current) awayAt = Date.now();
    current = null;
    cancelTimer();
  }
  function region(value: EventTarget | null): Element | null {
    const element = value as Element | null;
    if (
      !element ||
      element.nodeType !== 1 ||
      typeof element.closest !== "function" ||
      element.closest(excluded)
    )
      return null;
    const target = element.closest("[data-needle-attention-target]");
    return target?.isConnected &&
      target.getAttribute("data-needle-attention-target") === options.targetId
      ? target
      : null;
  }
  function enter(event: Event) {
    if (!event.isTrusted || disposed) return;
    if (!available()) {
      leave();
      return;
    }
    const target = region(event.target);
    if (target === current) return;
    leave();
    if (!target) return;
    current = target;
    // A quick excursion is still the same qualified visit. Suppress the entire
    // new stay, rather than letting small pointer jitter create a revisit later.
    if (ordinal > 0 && awayAt !== null && Date.now() - awayAt < REVISIT_AWAY_MS)
      return;
    startedAt = Date.now();
    setTracking(true);
    timer = setTimeout(() => {
      timer = undefined;
      if (!available() || current !== target || !target.isConnected) {
        leave();
        return;
      }
      const dwellMs = Date.now() - startedAt;
      setTracking(false);
      ordinal += 1;
      options.onObservation({
        action: ordinal === 1 ? "dwell" : "revisit",
        dwellMs,
        visitOrdinal: ordinal,
      });
    }, ATTENTION_DWELL_MS);
  }
  function out(event: Event) {
    if (!event.isTrusted || disposed) return;
    if (region((event as PointerEvent).relatedTarget) !== current) leave();
  }
  const stop = () => leave();
  const visibility = () => {
    if (doc.visibilityState !== "visible") leave();
  };
  doc.addEventListener("pointerover", enter, true);
  doc.addEventListener("pointermove", enter, true);
  doc.addEventListener("pointerout", out, true);
  doc.addEventListener("contextmenu", stop, true);
  doc.addEventListener("visibilitychange", visibility);
  doc.defaultView?.addEventListener("blur", stop);
  return () => {
    if (disposed) return;
    disposed = true;
    leave();
    doc.removeEventListener("pointerover", enter, true);
    doc.removeEventListener("pointermove", enter, true);
    doc.removeEventListener("pointerout", out, true);
    doc.removeEventListener("contextmenu", stop, true);
    doc.removeEventListener("visibilitychange", visibility);
    doc.defaultView?.removeEventListener("blur", stop);
  };
}
