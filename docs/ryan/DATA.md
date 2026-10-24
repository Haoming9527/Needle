# Data and evidence

[Part 4 home](README.md) · [Architecture](ARCHITECTURE.md)

## What the demo actually measures

Both local memory and cursor attention must be enabled. A trusted pointer must remain within a registered reading region for at least **2,000 ms**, while the page is visible and focused. Moving between nested children does not create another visit. A revisit requires leaving for at least **750 ms** and completing another qualifying dwell. Editable inputs and Needle UI are excluded; blur, hidden state, context menu, and cleanup clear partial tracking.

Measured metadata includes an event ID, session/page-instance IDs, registered source/target IDs, dwell duration, visit ordinal, action, timestamp, and validated document URL. The collector does not stream raw pointer coordinates, read arbitrary page text, or capture screenshots. This boundary applies to the attention collector; the separate user-triggered product identification workflow uses screenshots.

The recipe and commute pages have prepared server-owned summaries and topic labels. Their source IDs differ, but both run on `127.0.0.1:5173` (or the allowed localhost equivalent). Call them **two prepared sources**, not two independently instrumented public websites. Attention duration is measured; content semantics are prepared demo context.

## What AI receives and returns

Only an explicit request sends the reviewed, bounded saved summaries to the configured AI provider: up to 12 observations, their evidence IDs/source metadata, and an optional user correction. No full browsing history or screenshots are part of this synthesis request. Local storage alone is not an AI request.

A supported hypothesis must cite 2–6 unique existing observation IDs spanning at least two sources. The response includes a short proposed need, explanation, uncertainty, confirmation question, and a simple product query. It may abstain when the observations do not support a connection. Citations prove which observations were referenced; they do not prove the inference is true.

Structured-output validation rejects unknown citations and malformed results. Prompts treat page content as untrusted evidence, discourage sensitive inferences, and do not expose tools. The provider uses `store: false`; this request setting is not a promise about every provider’s retention policy.

## Interpretation and user control

Dwell means attention, not buying intent. Repeated related observations are deduplicated or capped rather than counted as independent proof. The prepared rules use heuristic interest/readiness states; their points are not calibrated purchase probabilities. Model assessments are also tentative, not predictive scores validated against customer outcomes.

People can inspect/remove observations, pause memory, reset stored context, dismiss an inference, or correct it. Confirmation authorizes finding an option for the current need. It does not place an order. Any sample price or offer remains labelled illustrative.
