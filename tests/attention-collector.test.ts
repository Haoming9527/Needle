import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mountAttentionCollector,
  type AttentionMeasurement,
} from "../src/attention/collector";
import { ATTENTION_DWELL_MS } from "../shared/attention";
class Events {
  listeners = new Map<string, Set<(event: Event) => void>>();
  addEventListener(name: string, listener: (event: Event) => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
  }
  removeEventListener(name: string, listener: (event: Event) => void) {
    this.listeners.get(name)?.delete(listener);
  }
  emit(name: string, details: object = {}) {
    for (const listener of this.listeners.get(name) ?? [])
      listener({ isTrusted: true, ...details } as Event);
  }
}
class FakeElement {
  nodeType = 1;
  isConnected = true;
  constructor(
    public targetId: string | null = null,
    public parent: FakeElement | null = null,
    public blocked = false,
  ) {}
  getAttribute(name: string) {
    return name === "data-needle-attention-target" ? this.targetId : null;
  }
  closest(selector: string): FakeElement | null {
    if (selector === "[data-needle-attention-target]")
      return this.targetId ? this : (this.parent?.closest(selector) ?? null);
    return this.blocked ? this : (this.parent?.closest(selector) ?? null);
  }
}
const disposals: Array<() => void> = [];
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
});
function setup(initialVisitOrdinal = 0) {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  const win = new Events();
  const doc = Object.assign(new Events(), {
    visibilityState: "visible",
    focused: true,
    defaultView: win,
    hasFocus() {
      return this.focused;
    },
  });
  const target = new FakeElement("recipe"),
    child = new FakeElement(null, target),
    other = new FakeElement("other");
  const observations: AttentionMeasurement[] = [];
  const tracking = vi.fn();
  const dispose = mountAttentionCollector({
    document: doc as unknown as Document,
    targetId: "recipe",
    initialVisitOrdinal,
    onObservation: (item) => observations.push(item),
    onTracking: tracking,
  });
  disposals.push(dispose);
  const enter = (element = target, trusted = true) =>
    doc.emit("pointerover", { target: element, isTrusted: trusted });
  const leave = () => doc.emit("pointerout", { target, relatedTarget: null });
  return {
    doc,
    win,
    target,
    child,
    other,
    observations,
    tracking,
    dispose,
    enter,
    leave,
  };
}
describe("registered-region measured attention", () => {
  it("requires threshold and emits only once while inside, including moves across nested children", () => {
    const s = setup();
    s.enter();
    vi.advanceTimersByTime(ATTENTION_DWELL_MS - 1);
    expect(s.observations).toEqual([]);
    s.doc.emit("pointerout", { target: s.target, relatedTarget: s.child });
    s.enter(s.child);
    vi.advanceTimersByTime(1);
    expect(s.observations).toEqual([
      { action: "dwell", dwellMs: ATTENTION_DWELL_MS, visitOrdinal: 1 },
    ]);
    s.doc.emit("pointermove", { target: s.child });
    vi.advanceTimersByTime(5000);
    expect(s.observations).toHaveLength(1);
    expect(s.tracking.mock.calls.map((call) => call[0])).toEqual([true, false]);
  });
  it("ignores untrusted events, other regions, and editing or overlay descendants", () => {
    const s = setup();
    s.enter(s.target, false);
    s.enter(s.other);
    s.enter(new FakeElement(null, s.target, true));
    vi.advanceTimersByTime(3000);
    expect(s.observations).toEqual([]);
  });
  it("does not start in hidden or unfocused documents and cancels on visibility or blur", () => {
    const s = setup();
    s.doc.visibilityState = "hidden";
    s.enter();
    vi.advanceTimersByTime(3000);
    s.doc.visibilityState = "visible";
    s.doc.focused = false;
    s.enter();
    vi.advanceTimersByTime(3000);
    expect(s.observations).toEqual([]);
    s.doc.focused = true;
    s.enter();
    vi.advanceTimersByTime(1500);
    s.doc.visibilityState = "hidden";
    s.doc.emit("visibilitychange");
    vi.advanceTimersByTime(3000);
    s.doc.visibilityState = "visible";
    s.enter();
    vi.advanceTimersByTime(1500);
    s.win.emit("blur");
    vi.advanceTimersByTime(3000);
    expect(s.observations).toEqual([]);
  });
  it("resets a partial stay and requires a real away interval before a revisit", () => {
    const s = setup();
    s.enter();
    vi.advanceTimersByTime(1500);
    s.leave();
    vi.advanceTimersByTime(100);
    s.enter();
    vi.advanceTimersByTime(500);
    expect(s.observations).toEqual([]);
    vi.advanceTimersByTime(1500);
    expect(s.observations).toHaveLength(1);
    s.leave();
    vi.advanceTimersByTime(749);
    s.enter();
    vi.advanceTimersByTime(5000);
    expect(s.observations).toHaveLength(1);
    s.leave();
    vi.advanceTimersByTime(750);
    s.enter();
    vi.advanceTimersByTime(2000);
    expect(s.observations[1]).toEqual({
      action: "revisit",
      dwellMs: 2000,
      visitOrdinal: 2,
    });
  });
  it("rejects detached targets at emission and cancels on contextmenu and cleanup", () => {
    const s = setup();
    s.enter();
    s.target.isConnected = false;
    vi.advanceTimersByTime(2500);
    expect(s.observations).toEqual([]);
    s.target.isConnected = true;
    s.enter();
    vi.advanceTimersByTime(1500);
    s.doc.emit("contextmenu");
    vi.advanceTimersByTime(2500);
    expect(s.observations).toEqual([]);
    s.enter();
    s.dispose();
    s.dispose();
    vi.advanceTimersByTime(2500);
    s.enter();
    vi.advanceTimersByTime(2500);
    expect(s.observations).toEqual([]);
    expect(s.tracking).toHaveBeenLastCalledWith(false);
    expect(
      [...s.doc.listeners.values()].every((listeners) => listeners.size === 0),
    ).toBe(true);
  });
  it("continues visit numbering supplied by the consent-owning caller", () => {
    const s = setup(2);
    s.enter();
    vi.advanceTimersByTime(2000);
    expect(s.observations[0]).toMatchObject({
      action: "revisit",
      visitOrdinal: 3,
    });
  });
});
