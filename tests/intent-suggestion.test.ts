import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../server/app.js";
import type { ServerConfig } from "../server/config.js";
import type { IntentStore } from "../server/intent.js";
import type { ProductProvider, ProviderResult } from "../server/provider.js";
import {
  intentSuggestionKey,
  type IntentHypothesis,
} from "../shared/intent.js";
import type { Interpretation, Offer } from "../shared/types.js";

const config: ServerConfig = {
  exaKey: "",
  openAiKey: "",
  model: "test",
  defaultMode: "sample",
  timeoutMs: 10_000,
  orderFile: null,
};
const interpretation: Interpretation = {
  name: "Lunch container",
  productType: "container",
  brand: null,
  model: null,
  color: null,
  attributes: [],
  queries: ["portable lunch container"],
  needsClarification: false,
  clarification: null,
};
const offer: Offer = {
  id: "lunch",
  title: "Lunch container",
  description: "Prepared portable container",
  imageUrl: null,
  sourceUrl: null,
  match: "similar",
  matchEvidence: "Demo match",
  price: 20,
  currency: "USD",
  observedAt: "2026-10-25",
  dataOrigin: "sample",
  variants: [],
  shipping: null,
  availability: null,
  returns: null,
  reason: "Easy to carry",
  differences: [],
};
const path = "/intent/hypotheses/lunch-on-the-move/recommendation";
const feedbackPath = "/intent/hypotheses/lunch-on-the-move/feedback";
function seed(store: IntentStore): IntentHypothesis {
  store.setConsent(true);
  store.record({
    id: "recipe",
    action: "dwell",
    sourceOrigin: "https://recipes.example",
    sourceTitle: "Meal prep",
    summary: "Preparing lunches ahead",
    tags: ["meal-prep"],
    provenance: "demo_fixture",
    entityKey: "meal",
  });
  store.record({
    id: "commute",
    action: "revisit",
    sourceOrigin: "https://cycling.example",
    sourceTitle: "Bike commute",
    summary: "Cycling to work",
    tags: ["cycle-commute"],
    provenance: "demo_fixture",
    entityKey: "commute",
  });
  return store.getState().hypotheses[0]!;
}
function setup(
  search = vi.fn<ProductProvider["search"]>(async () => ({
    offers: [offer],
    warnings: [],
  })),
) {
  const identify = vi.fn<ProductProvider["identify"]>(
    async () => interpretation,
  );
  const app = createApp({ config, sampleProvider: { identify, search } });
  return { app, identify, search, store: app.locals.intent as IntentStore };
}

describe("confirmed context product suggestions", () => {
  it("does not invoke providers without consent, confirmation, or the current context key", async () => {
    const { app, identify, search, store } = setup();
    try {
      expect(
        (await request(app).post(path).send({ contextKey: "forged" })).body
          .error.code,
      ).toBe("INTENT_PAUSED");
      const tentative = seed(store);
      const unconfirmed = await request(app)
        .post(path)
        .send({ contextKey: intentSuggestionKey(tentative) });
      expect(unconfirmed.status).toBe(409);
      expect(unconfirmed.body.error.code).toBe("INTENT_CONFIRMATION_REQUIRED");
      store.feedback(tentative.id, { action: "confirm" });
      const stale = await request(app)
        .post(path)
        .send({ contextKey: intentSuggestionKey(tentative) });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe("INTENT_CONTEXT_CHANGED");
      expect(identify).not.toHaveBeenCalled();
      expect(search).not.toHaveBeenCalled();
      expect(
        app.locals.database.connection
          .prepare("SELECT COUNT(*) AS n FROM sessions")
          .get().n,
      ).toBe(0);
    } finally {
      app.locals.database.close();
    }
  });

  it("derives the query and budget from reviewed context and changes both key and query after correction", async () => {
    const { app, identify, search, store } = setup();
    try {
      const tentative = seed(store);
      const confirmed = store.feedback(tentative.id, {
        action: "confirm",
        constraints: "under USD 30",
      }).hypotheses[0]!;
      const originalKey = intentSuggestionKey(confirmed);
      const first = await request(app)
        .post(path)
        .send({ contextKey: originalKey })
        .expect(200);
      expect(identify.mock.calls[0]?.[0]).toEqual({
        text: "portable lunch container; under USD 30",
        pageTitle: "Needle confirmed context",
      });
      expect(search.mock.calls[0]?.[1]).toEqual({
        budget: 30,
        currency: "USD",
      });
      expect(
        app.locals.database.session(first.body.sessionId).selection.text,
      ).toBe("portable lunch container; under USD 30");
      const corrected = (
        await request(app)
          .post(feedbackPath)
          .send({ action: "correct", correction: "home-meal-prep" })
          .expect(200)
      ).body.hypotheses[0] as IntentHypothesis;
      const correctedKey = intentSuggestionKey(corrected);
      expect(correctedKey).not.toBe(originalKey);
      await request(app)
        .post(path)
        .send({ contextKey: originalKey })
        .expect(409);
      await request(app)
        .post(path)
        .send({ contextKey: correctedKey })
        .expect(200);
      expect(identify.mock.calls[1]?.[0]).toEqual({
        text: "food storage container; under USD 30",
        pageTitle: "Needle confirmed context",
      });
      expect(identify).toHaveBeenCalledTimes(2);
      expect(store.getState().observations).toHaveLength(2);
      expect(store.getState().hypotheses[0]?.evidencePoints).toBe(4);
    } finally {
      app.locals.database.close();
    }
  });

  it.each(["pause", "dismiss", "remove", "correct"] as const)(
    "discards delayed provider results after %s without persisting a stale session",
    async (change) => {
      let release!: (value: ProviderResult) => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const deferred = new Promise<ProviderResult>((resolve) => {
        release = resolve;
      });
      const search = vi.fn<ProductProvider["search"]>(async () => {
        entered();
        return deferred;
      });
      const { app, store } = setup(search);
      try {
        seed(store);
        const confirmed = store.feedback("lunch-on-the-move", {
          action: "confirm",
        }).hypotheses[0]!;
        const pending = request(app)
          .post(path)
          .send({ contextKey: intentSuggestionKey(confirmed) })
          .then((response) => response);
        await started;
        if (change === "pause")
          await request(app)
            .post("/intent/consent")
            .send({ enabled: false })
            .expect(200);
        if (change === "dismiss")
          await request(app)
            .post(feedbackPath)
            .send({ action: "dismiss" })
            .expect(200);
        if (change === "remove")
          await request(app)
            .post("/intent/observations/commute/remove")
            .send({})
            .expect(200);
        if (change === "correct")
          await request(app)
            .post(feedbackPath)
            .send({ action: "correct", correction: "home-meal-prep" })
            .expect(200);
        release({ offers: [offer], warnings: [] });
        const result = await pending;
        expect(result.status).toBe(409);
        expect(result.body.sessionId).toBeUndefined();
        expect(result.body.offers).toBeUndefined();
        expect(
          app.locals.database.connection
            .prepare("SELECT COUNT(*) AS n FROM sessions")
            .get().n,
        ).toBe(0);
        expect(search).toHaveBeenCalledTimes(1);
      } finally {
        release({ offers: [], warnings: [] });
        app.locals.database.close();
      }
    },
  );
});
