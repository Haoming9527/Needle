# Architecture and data

Both local memory and cursor attention require opt-in. A trusted pointer must dwell for 2 seconds in a registered reading region while the page is visible and focused. A revisit requires at least 750 ms away and a fresh qualifying dwell. Nested movements do not inflate visits; cleanup cancels partial tracking.

The collector records event/session/source identities, duration, visit ordinal, action, timestamp, and validated page URL. It does not stream pointer coordinates, take screenshots, or read arbitrary page text. Prepared recipe/commute summaries are server-owned demo context. This limitation does not describe the separate explicit screenshot-based product identification feature.

On an explicit request, `/intent/synthesize` sends at most 12 reviewed observations to the configured provider. A hypothesis must cite 2–6 valid unique observations across at least two sources and include uncertainty. Unsupported connections can abstain. The model has no discovery or purchase tools.

`/intent/hypotheses/:id/recommendation` requires current consent, a confirmed current hypothesis, and its suggestion key. The server supplies the persisted query and constraints to existing discovery. Correction withdraws old confirmation. Evidence changes, pause, reset, and feedback invalidate stale results.

Local context, prepared rules, and model output have distinct provenance. A failed provider call must not silently become a fabricated AI answer. Citations identify evidence; they do not establish that an inference is correct.

[Component map](https://github.com/Haoming9527/Needle/blob/codex/connected-intent-demo/docs/ryan/ARCHITECTURE.md) · [Data contract and interpretation](https://github.com/Haoming9527/Needle/blob/codex/connected-intent-demo/docs/ryan/DATA.md) · [[Demo and setup|Demo-and-Setup]]
