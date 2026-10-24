import { afterEach, describe, expect, it, vi } from "vitest";
import { mountAttentionCapture } from "../src/attention/client";
import { mountAttentionCollector } from "../src/attention/collector";
import { apiRequest, RequestError } from "../src/panel/api";
import type { IntentState } from "../shared/intent";
import type { AttentionCapture } from "../shared/attention";
vi.mock("../src/attention/collector", () => ({
  mountAttentionCollector: vi.fn(),
}));
vi.mock("../src/panel/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/panel/api")>()),
  apiRequest: vi.fn(),
}));
class Events {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(name: string, callback: () => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(callback);
  }
  removeEventListener(name: string, callback: () => void) {
    this.listeners.get(name)?.delete(callback);
  }
  emit(name: string) {
    for (const callback of this.listeners.get(name) ?? []) callback();
  }
}
const allowed: IntentState = {
  consent: true,
  attentionConsent: true,
  observations: [],
  hypotheses: [],
};
const disposals: Array<() => void> = [];
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};
function setup(
  url = "http://localhost:5173/recipe-demo.html?private=discard#hidden",
) {
  vi.useFakeTimers();
  const win = Object.assign(new Events(), {
    location: new URL(url),
    setInterval,
    clearInterval,
  });
  const doc = Object.assign(new Events(), { visibilityState: "visible" });
  const storage = new Map<string, string>();
  vi.stubGlobal("window", win);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  const stop = vi.fn();
  vi.mocked(mountAttentionCollector).mockReturnValue(stop);
  vi.mocked(apiRequest).mockResolvedValue(allowed);
  const status = vi.fn();
  const dispose = mountAttentionCapture({ onStatus: status });
  disposals.push(dispose);
  return { win, doc, stop, status, dispose };
}
const observe = () =>
  vi
    .mocked(mountAttentionCollector)
    .mock.calls.at(-1)![0]
    .onObservation({ action: "dwell", dwellMs: 2000, visitOrdinal: 1 });
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose());
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("consent-scoped attention client", () => {
  it("mounts only on registered pages with both consents and cancels when hidden/unmounted", async () => {
    const s = setup();
    await flush();
    expect(mountAttentionCollector).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mountAttentionCollector).mock.calls[0][0]).toMatchObject({
      targetId: "meal-prep-reading",
      initialVisitOrdinal: 0,
    });
    s.doc.visibilityState = "hidden";
    s.doc.emit("visibilitychange");
    expect(s.stop).toHaveBeenCalledTimes(1);
    observe();
    await flush();
    expect(
      vi.mocked(apiRequest).mock.calls.every(([path]) => path === "/intent"),
    ).toBe(true);
    s.dispose();
    expect([...s.win.listeners.values()].every((set) => set.size === 0)).toBe(
      true,
    );
    expect([...s.doc.listeners.values()].every((set) => set.size === 0)).toBe(
      true,
    );
  });
  it.each([
    { consent: false, attentionConsent: true },
    { consent: true, attentionConsent: false },
  ])("does not collect with %j", async (flags) => {
    const s = setup();
    vi.mocked(apiRequest).mockResolvedValue({ ...allowed, ...flags });
    s.win.emit("needle-attention-consent");
    await flush();
    expect(mountAttentionCollector).not.toHaveBeenCalled();
    expect(s.status.mock.calls.at(-1)?.[0].phase).toBe("paused");
  });
  it("does not contact the API from unregistered pages", async () => {
    setup("https://example.com/recipe-demo.html");
    await flush();
    expect(apiRequest).not.toHaveBeenCalled();
    expect(mountAttentionCollector).not.toHaveBeenCalled();
  });
  it("sends bounded registered metadata and retries failed transport with the same observation ID", async () => {
    const s = setup();
    await flush();
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === "/intent/attention") throw new RequestError("offline");
      return allowed;
    });
    observe();
    await flush();
    const first = vi
      .mocked(apiRequest)
      .mock.calls.find(
        ([path]) => path === "/intent/attention",
      )![1] as AttentionCapture;
    expect(first).toMatchObject({
      sourceId: "recipe-guide",
      targetId: "meal-prep-reading",
      action: "dwell",
      measurement: { dwellMs: 2000, visitOrdinal: 1 },
      documentUrl: "http://localhost:5173/recipe-demo.html",
    });
    for (const id of [first.id, first.sessionId, first.pageInstanceId])
      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(Object.keys(first).sort()).toEqual([
      "action",
      "capturedAt",
      "documentUrl",
      "id",
      "measurement",
      "pageInstanceId",
      "sessionId",
      "sourceId",
      "targetId",
    ]);
    expect(s.stop).toHaveBeenCalled();
    vi.mocked(apiRequest).mockResolvedValue(allowed);
    s.win.emit("needle-attention-retry");
    await flush();
    const calls = vi
      .mocked(apiRequest)
      .mock.calls.filter(([path]) => path === "/intent/attention");
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toEqual(first);
    expect(s.status.mock.calls.at(-1)?.[0].phase).toBe("recorded");
  });
  it.each(["event", "poll"] as const)(
    "discards pending capture after %s opt-out and ignores a late successful POST",
    async (mode) => {
      const s = setup();
      await flush();
      let finish!: (value: IntentState) => void;
      const pending = new Promise<IntentState>((resolve) => {
        finish = resolve;
      });
      vi.mocked(apiRequest).mockImplementation(async (path) =>
        path === "/intent/attention"
          ? pending
          : { ...allowed, attentionConsent: false },
      );
      observe();
      await flush();
      const sendSignal = vi
        .mocked(apiRequest)
        .mock.calls.find(([path]) => path === "/intent/attention")![2]!;
      if (mode === "event") s.win.emit("needle-attention-consent");
      else await vi.advanceTimersByTimeAsync(1500);
      await flush();
      expect(sendSignal.aborted).toBe(true);
      finish(allowed);
      await flush();
      expect(mountAttentionCollector).toHaveBeenCalledTimes(1);
      expect(s.status.mock.calls.at(-1)?.[0].phase).toBe("paused");
      s.win.emit("needle-attention-retry");
      await flush();
      expect(
        vi
          .mocked(apiRequest)
          .mock.calls.filter(([path]) => path === "/intent/attention"),
      ).toHaveLength(1);
    },
  );
  it("fails closed on a consent polling error even when an earlier send later succeeds", async () => {
    const s = setup();
    await flush();
    let finish!: (value: IntentState) => void;
    const pending = new Promise<IntentState>((resolve) => {
      finish = resolve;
    });
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === "/intent/attention") return pending;
      throw new RequestError("consent service offline");
    });
    observe();
    await flush();
    const sendSignal = vi
      .mocked(apiRequest)
      .mock.calls.find(([path]) => path === "/intent/attention")![2]!;
    await vi.advanceTimersByTimeAsync(1500);
    expect(sendSignal.aborted).toBe(true);
    finish(allowed);
    await flush();
    expect(mountAttentionCollector).toHaveBeenCalledTimes(1);
    expect(s.status.mock.calls.at(-1)?.[0].phase).toBe("error");
  });
  it("aborts a pending send on disposal and does not report its late response", async () => {
    const s = setup();
    await flush();
    let finish!: (value: IntentState) => void;
    const pending = new Promise<IntentState>((resolve) => {
      finish = resolve;
    });
    vi.mocked(apiRequest).mockReturnValue(pending);
    observe();
    await flush();
    const signal = vi.mocked(apiRequest).mock.calls.at(-1)![2]!;
    s.dispose();
    const statuses = s.status.mock.calls.length;
    expect(signal.aborted).toBe(true);
    finish(allowed);
    await flush();
    expect(s.status).toHaveBeenCalledTimes(statuses);
  });
});
