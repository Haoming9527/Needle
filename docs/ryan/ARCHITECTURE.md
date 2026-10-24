# Architecture

[Part 4 home](README.md) · [Data](DATA.md) · [Integration](INTEGRATION.md)

The flow is: **opt in → measure → review saved context → explicitly connect with AI → inspect evidence and uncertainty → confirm or correct → find an option**.

| Layer | Owning source | Responsibility |
| --- | --- | --- |
| Source registry | [`shared/attention.ts`](../../shared/attention.ts) | Fixed demo source, path, and target contracts; 2-second threshold |
| Attention collector | [`src/attention/collector.ts`](../../src/attention/collector.ts) | Trusted pointer dwell/revisit measurement and lifecycle cleanup |
| Attention coordinator | [`src/attention/client.ts`](../../src/attention/client.ts) | Consent checks, event identity, transport retries, cancellation |
| Context store | [`server/intent.ts`](../../server/intent.ts) | Durable observations, deduplication, feedback, context revisions |
| Synthesis contract | [`shared/synthesis.ts`](../../shared/synthesis.ts) | Bounded snapshot and structured assessment |
| AI adapter | [`server/intent-synthesizer.ts`](../../server/intent-synthesizer.ts) | Configured model, strict validation, evidence references, abstention |
| API gates | [`server/app.ts`](../../server/app.ts) | Consent/current-context checks and confirmed recommendation endpoint |
| Review UI | [`src/panel/IntentWorkspace.tsx`](../../src/panel/IntentWorkspace.tsx) | Source review, explicit synthesis, confirmation/correction, inline result |

`POST /intent/synthesize` accepts the current context key and optional correction. It does not run product discovery. The server selects the bounded snapshot, invokes the configured provider, validates the result, and persists only a still-current assessment. Repeating an unchanged assessment can reuse its cached result, including abstention.

`POST /intent/hypotheses/:id/recommendation` requires consent, a confirmed hypothesis, and its current suggestion key. The server supplies the persisted product query and constraints to the existing discovery pipeline. The model does not get a search or purchase tool.

Correction withdraws the previous confirmation. A revised hypothesis requires confirmation again. Pausing memory, removing evidence, resetting, or changing feedback invalidates stale work; delayed responses must not restore an old recommendation. These are server checks as well as UI cleanup, with mocked-provider integration tests.

The ordinary cursor automatically searches and keeps **Buy / Add to cart / ×**. Find is the default; Discover and Saved are optional panel views. Part 4 does not replace screenshot identification, crop clarification, explicit searches, or voice interactions. Prepared rules and model output carry different provenance; a provider failure must not silently become a rule-generated “AI” answer.
