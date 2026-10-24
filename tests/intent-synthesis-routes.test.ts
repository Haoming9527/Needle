import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../server/app.js";
import { ApiError } from "../server/errors.js";
import type { ServerConfig } from "../server/config.js";
import type { IntentStore } from "../server/intent.js";
import type { ProductProvider, ProviderResult } from "../server/provider.js";
import {
  intentSuggestionKey,
  type IntentHypothesis,
  type IntentObservationInput,
} from "../shared/intent.js";
import type {
  SynthesisOutput,
  SynthesisProvider,
} from "../shared/synthesis.js";
import type { Interpretation, Offer } from "../shared/types.js";
const config: ServerConfig = {
  exaKey: "",
  openAiKey: "",
  model: "test",
  defaultMode: "sample",
  timeoutMs: 10000,
  orderFile: null,
};
const trip: IntentObservationInput = {
  id: "trip",
  action: "dwell",
  sourceOrigin: "https://trips.example",
  sourceTitle: "Train outings",
  summary: "Weekend train journeys",
  tags: [],
  provenance: "observed",
};
const art: IntentObservationInput = {
  id: "art",
  action: "revisit",
  sourceOrigin: "https://art.example",
  sourceTitle: "Outdoor sketches",
  summary: "Watercolour landscape sketches outdoors",
  tags: [],
  provenance: "observed",
};
const output: SynthesisOutput = {
  outcome: "hypothesis",
  label: "Sketching on trips",
  need: "A portable sketching kit for short outings.",
  why: "Train outings and outdoor sketching could overlap.",
  uncertainty: "These interests might be unrelated.",
  question: "Would you take a sketching kit on your trips?",
  productQuery: "portable watercolour sketching kit",
  evidence: [
    { observationId: "trip", reason: "Possible journey context." },
    { observationId: "art", reason: "Possible outdoor sketching need." },
  ],
};
const abstain: SynthesisOutput = {
  outcome: "abstain",
  label: null,
  need: null,
  why: null,
  uncertainty: "No supported connection.",
  question: null,
  productQuery: null,
  evidence: [],
};
const interpreted: Interpretation = {
  name: "Sketching kit",
  productType: "art supplies",
  brand: null,
  model: null,
  color: null,
  attributes: [],
  queries: ["sketching kit"],
  needsClarification: false,
  clarification: null,
};
const offer: Offer = {
  id: "art-kit",
  title: "Prepared sketching kit",
  description: "Portable",
  imageUrl: null,
  sourceUrl: null,
  match: "similar",
  matchEvidence: "Demo",
  price: 20,
  currency: "USD",
  observedAt: "2026-10-25",
  dataOrigin: "sample",
  variants: [],
  shipping: null,
  availability: null,
  returns: null,
  reason: "Compact",
  differences: [],
};
const apps: ReturnType<typeof createApp>[] = [];
afterEach(() => {
  apps.splice(0).forEach((app) => app.locals.database.close());
  vi.useRealTimers();
});
function setup(withModel = true, timeoutMs = 10000) {
  const synthesize = vi.fn<SynthesisProvider["synthesize"]>(async () => output);
  const identify = vi.fn<ProductProvider["identify"]>(async () => interpreted);
  const search = vi.fn<ProductProvider["search"]>(async () => ({
    offers: [offer],
    warnings: [],
  }));
  const app = createApp({
    config: { ...config, timeoutMs },
    sampleProvider: { identify, search },
    ...(withModel ? { intentSynthesisProvider: { synthesize } } : {}),
  });
  apps.push(app);
  const store = app.locals.intent as IntentStore;
  return { app, store, synthesize, identify, search };
}
function seed(store: IntentStore) {
  store.setConsent(true);
  store.record(trip);
  store.record(art);
  return store.synthesisSnapshot().contextKey;
}
const connect = (
  app: ReturnType<typeof createApp>,
  contextKey: string,
  correction?: string,
) =>
  request(app)
    .post("/intent/synthesize")
    .send({ contextKey, ...(correction ? { correction } : {}) });
const modelHypothesis = (state: { hypotheses: IntentHypothesis[] }) =>
  state.hypotheses.find((h) => h.origin?.kind === "model")!;
function barrier<T>() {
  let release!: (value: T) => void;
  let enter!: () => void;
  return {
    entered: new Promise<void>((resolve) => {
      enter = resolve;
    }),
    result: new Promise<T>((resolve) => {
      release = resolve;
    }),
    get release() {
      return release;
    },
    get enter() {
      return enter;
    },
  };
}

describe("explicit AI context synthesis routes", () => {
  it("rejects no consent, stale context, one source, and missing credentials before any model or search calls", async () => {
    const s = setup();
    await connect(s.app, s.store.synthesisSnapshot().contextKey).expect(409);
    s.store.setConsent(true);
    s.store.record(trip);
    await connect(s.app, s.store.synthesisSnapshot().contextKey).expect(422);
    s.store.record(art);
    await connect(s.app, "stale-context").expect(409);
    expect(s.synthesize).not.toHaveBeenCalled();
    expect(s.identify).not.toHaveBeenCalled();
    expect(s.search).not.toHaveBeenCalled();
    const missing = setup(false);
    const key = seed(missing.store);
    const response = await connect(missing.app, key).expect(503);
    expect(response.body.error.code).toBe("AI_NOT_CONFIGURED");
    expect(missing.identify).not.toHaveBeenCalled();
  });
  it("accepts arbitrary empty-tag observations and searches only the persisted query after confirmation", async () => {
    const s = setup();
    s.store.setConsent(true);
    await request(s.app).post("/intent/observations").send(trip).expect(200);
    await request(s.app).post("/intent/observations").send(art).expect(200);
    const connected = await connect(
      s.app,
      s.store.synthesisSnapshot().contextKey,
    ).expect(200);
    const hypothesis = modelHypothesis(connected.body);
    expect(hypothesis.recommendationKey).toBe("contextual");
    expect(hypothesis.interest).toBe("tentative");
    const endpoint = `/intent/hypotheses/${hypothesis.id}/recommendation`;
    await request(s.app)
      .post(endpoint)
      .send({ contextKey: intentSuggestionKey(hypothesis) })
      .expect(409);
    expect(s.identify).not.toHaveBeenCalled();
    expect(s.search).not.toHaveBeenCalled();
    const confirmed = s.store
      .feedback(hypothesis.id, {
        action: "confirm",
        constraints: "under USD 30",
      })
      .hypotheses.find((h) => h.id === hypothesis.id)!;
    await request(s.app)
      .post(endpoint)
      .send({ contextKey: intentSuggestionKey(confirmed) })
      .expect(200);
    expect(s.identify.mock.calls[0][0].text).toBe(
      "portable watercolour sketching kit; under USD 30",
    );
    expect(s.search.mock.calls[0][1]).toEqual({ budget: 30, currency: "USD" });
    expect(s.store.getState().observations).toHaveLength(2);
  });
  it.each([output, abstain])(
    "caches outcome $outcome; repeated POST and GET/poll reads do not rerun AI",
    async (result) => {
      const s = setup();
      s.synthesize.mockResolvedValue(result);
      const key = seed(s.store);
      const first = await connect(s.app, key).expect(200);
      await connect(s.app, key).expect(200);
      await request(s.app).get("/intent").expect(200);
      await request(s.app).get("/intent").expect(200);
      expect(s.synthesize).toHaveBeenCalledTimes(1);
      expect(s.search).not.toHaveBeenCalled();
      expect(first.body.synthesis.status).toBe(
        result.outcome === "abstain" ? "abstained" : "ready",
      );
      if (result.outcome === "abstain")
        expect(first.body.hypotheses).toEqual([]);
    },
  );
  it("enforces strict request fields and rejects provider citations outside the snapshot", async () => {
    const s = setup();
    const key = seed(s.store);
    await request(s.app)
      .post("/intent/synthesize")
      .send({ contextKey: key, productQuery: "forged" })
      .expect(400);
    expect(s.synthesize).not.toHaveBeenCalled();
    s.synthesize.mockResolvedValue({
      ...output,
      evidence: [
        { observationId: "invented", reason: "unknown" },
        output.evidence[1],
      ],
    });
    const bad = await connect(s.app, key).expect(502);
    expect(bad.body.error.code).toBe("SYNTHESIS_INVALID");
    expect(s.store.getState().synthesis?.result).toBeUndefined();
  });
  it.each(["pause", "remove", "reset", "feedback"] as const)(
    "rejects delayed synthesis after %s without persisting it",
    async (change) => {
      const s = setup();
      const key = seed(s.store);
      // Add a legitimate rule hypothesis solely to exercise feedback invalidation.
      if (change === "feedback") {
        s.store.record({ ...trip, id: "recipe", tags: ["meal-prep"] });
        s.store.record({ ...art, id: "commute", tags: ["cycle-commute"] });
      }
      const activeKey = s.store.synthesisSnapshot().contextKey;
      const gate = barrier<SynthesisOutput>();
      s.synthesize.mockImplementation(async () => {
        gate.enter();
        return gate.result;
      });
      const pending = connect(
        s.app,
        change === "feedback" ? activeKey : key,
      ).then((response) => response);
      await gate.entered;
      if (change === "pause") s.store.setConsent(false);
      if (change === "remove") s.store.remove("art");
      if (change === "reset") s.store.reset();
      if (change === "feedback")
        s.store.feedback("lunch-on-the-move", { action: "dismiss" });
      gate.release(output);
      const response = await pending;
      expect(response.status).toBe(409);
      expect(s.store.getState().synthesis?.result).toBeUndefined();
      expect(s.search).not.toHaveBeenCalled();
    },
  );
  it("withdraws a reviewed need immediately during correction and makes replacement tentative", async () => {
    const s = setup();
    const key = seed(s.store);
    const first = await connect(s.app, key).expect(200);
    const old = modelHypothesis(first.body);
    s.store.feedback(old.id, { action: "confirm" });
    const gate = barrier<SynthesisOutput>();
    s.synthesize.mockImplementation(async () => {
      gate.enter();
      return gate.result;
    });
    const pending = connect(
      s.app,
      key,
      "I paint at home; the train trips are unrelated.",
    ).then((r) => r);
    await gate.entered;
    expect(
      s.store.getState().hypotheses.find((h) => h.id === old.id)?.status,
    ).not.toBe("active");
    gate.release({
      ...output,
      label: "Painting at home",
      need: "Art supplies for home practice.",
      productQuery: "watercolour painting supplies",
    });
    const response = await pending;
    expect(response.status).toBe(200);
    expect(modelHypothesis(response.body).interest).toBe("tentative");
    expect(s.search).not.toHaveBeenCalled();
  });
  it.each(["evidence", "synthesis"] as const)(
    "rejects a delayed product after changed %s and writes no stale session",
    async (change) => {
      const s = setup();
      const key = seed(s.store);
      const first = await connect(s.app, key).expect(200);
      const h = modelHypothesis(first.body);
      const confirmed = s.store
        .feedback(h.id, { action: "confirm" })
        .hypotheses.find((item) => item.id === h.id)!;
      const gate = barrier<ProviderResult>();
      s.search.mockImplementation(async () => {
        gate.enter();
        return gate.result;
      });
      const pending = request(s.app)
        .post(`/intent/hypotheses/${h.id}/recommendation`)
        .send({ contextKey: intentSuggestionKey(confirmed) })
        .then((r) => r);
      await gate.entered;
      if (change === "evidence") s.store.remove("art");
      else
        await connect(
          s.app,
          key,
          "I want supplies for indoor sketching.",
        ).expect(200);
      gate.release({ offers: [offer], warnings: [] });
      expect((await pending).status).toBe(409);
      expect(
        s.app.locals.database.connection
          .prepare("SELECT COUNT(*) AS n FROM sessions")
          .get().n,
      ).toBe(0);
    },
  );
  it("reports provider errors without a fake synthesized result", async () => {
    const s = setup();
    const key = seed(s.store);
    s.synthesize.mockRejectedValue(
      new ApiError(502, "SYNTHESIS_MODEL_RESPONSE", "Cannot connect context."),
    );
    const response = await connect(s.app, key).expect(502);
    expect(response.body.error.code).toBe("SYNTHESIS_MODEL_RESPONSE");
    expect(s.store.getState().synthesis?.result).toBeUndefined();
    expect(s.search).not.toHaveBeenCalled();
  });
  it("times out a blocked synthesis and aborts its signal without saving a result", async () => {
    const s = setup(true, 100);
    const key = seed(s.store);
    const gate = barrier<SynthesisOutput>();
    s.synthesize.mockImplementation(async () => {
      gate.enter();
      return gate.result;
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = connect(s.app, key).then((r) => r);
    await gate.entered;
    await vi.advanceTimersByTimeAsync(101);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(s.synthesize.mock.calls[0][1].aborted).toBe(true);
    expect(s.store.getState().synthesis?.result).toBeUndefined();
    gate.release(output);
  });
});
