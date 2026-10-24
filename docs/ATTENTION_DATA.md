# Cursor attention data contract

## What is live and what is prepared

The demo measures trusted pointer interactions in two registered reading regions. The articles, topic tags and topic-to-need rules are prepared. Both pages run on the same local origin; they represent **two controlled demo sources**, not verified browsing across two independent websites. The existing extension still captures only explicit Save / Find interactions on ordinary websites.

| Input | Producer | Stored evidence | Effect |
| --- | --- | --- | --- |
| Cursor pause / return | Controlled source page + shared attention collector | Source ID, actual origin, region ID, dwell duration, visit ordinal, session/page IDs, timestamp | Weak evidence, capped at 2 points per source |
| Save inspiration / wishlist | Existing capture and commerce routes | Bounded content summary, source, tags, stable item identity | Explicit interest; Considering readiness |
| Cart | Existing cart route | Product identity and action | Ready to review, not a completed purchase |
| Confirmation / correction | Discover question | Feedback bound to the exact supporting observation IDs, optional constraint | Allows the guarded recommendation route |

All producers feed the same SQLite `IntentStore`. Search relevance, image recognition, crop selection and candidate ranking remain unchanged. The separate Logan seller workspace is not connected to this memory.

## Registered scenario data

`shared/attention.ts` owns the source registry. Browser clients cannot supply arbitrary topic tags or summaries through the measured-attention endpoint.

| Source | Page | Region | Prepared topic | Proposed connection |
| --- | --- | --- | --- | --- |
| `recipe-guide` | `/recipe-demo.html` | `meal-prep-reading` | `meal-prep` | Preparing food ahead |
| `commute-guide` | `/commute-demo.html` | `commute-reading` | `cycle-commute` | Carrying it on a commute might be useful |

One source yields no hypothesis. Two complementary sources yield a tentative question at 4 heuristic points with Exploring readiness. A revisit does not raise the source's point cap. Weak replay and measured evidence are separate cohorts, so running the fallback cannot double the score. Explicit later Save/cart signals can still change readiness.

## Ingestion

1. Enable existing memory through `POST /intent/consent`.
2. Separately enable this demo collector through `POST /intent/attention/consent`.
3. The collector measures a trusted pointer stay of at least 2,000ms in the registered region while the document is visible and focused. Moving across nested text does not restart the timer. A qualified return requires leaving for at least 750ms, then another dwell.
4. `POST /intent/attention` accepts an `AttentionCapture` and returns the complete shared intent state. The server validates both consents, source URL, region, identifiers and measurement bounds, then supplies canonical context from the registry.
5. Discover refreshes the shared state when it regains focus. Confirmation remains necessary before a recommendation.

```ts
interface AttentionCapture {
  id: string;            // UUID retained when retrying this event
  sessionId: string;     // sessionStorage ID across demo-page navigation
  pageInstanceId: string;
  sourceId: 'recipe-guide' | 'commute-guide';
  targetId: string;
  action: 'dwell' | 'revisit';
  measurement: { dwellMs: number; visitOrdinal: number };
  capturedAt: string;    // ISO timestamp
  documentUrl: string;   // registered local page, query/hash omitted
}
```

Stored observations retain `provenance: 'demo_fixture'` because their content semantics are prepared, plus `capture.method: 'measured_cursor'` and `capture.environment: 'controlled_demo'`. The measured metadata also appears in the supporting connection, so the UI does not confuse live timing with verified user habits.

No screenshots, raw pointer coordinates, movement trails, full article text or browsing history are sent by this collector. The local API validates payloads but cannot independently attest physical interaction; measurements are client-reported. This is a local single-user demonstration, not an authenticated production telemetry service.

## Retraction and reliability

Memory pause also disables attention. Local page pause stops collection; other-page consent changes are polled every 1.5 seconds, and server-side consent is checked on every ingestion. Blur, hidden tabs, context menus and unmount cancel partial dwell. Transport retry retains the same event UUID. Semantic identity merges repeat visits, preserving the observation ID. Removing a source invalidates feedback bound to that evidence; replacement evidence requires a fresh confirmation.

For broader cross-site capture, the next producer should use the same event/store contract with explicit domain consent, bounded content extraction, canonical content identity and a defined topic-classification policy. Do not label arbitrary third-party browsing as supported by this controlled demonstration.
