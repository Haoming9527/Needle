# Step 4: connecting observations with AI

Needle now has an explicit synthesis stage between saved context and product search. It proposes one tentative need, gives a short explanation tied to stored observations, or says the evidence is insufficient. It cannot search products or change the cart. The shopper checks the need before the existing search pipeline runs.

## Rehearsal and configuration

1. Run the API and panel with `npm run dev`. For isolated demo data, set `DATABASE_PATH=.local/connected-demo-review.sqlite` before starting.
2. Configure `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY` in the backend environment and restart. An existing OpenAI key takes precedence. `OPENAI_MODEL` is preserved; no model migration is part of this change. Exa is unnecessary for synthesis, but the existing product-search fallback still needs its usual credentials.
3. Enable context memory and the separate reading-page attention opt-in. Collect the recipe and commuting observations, or explicitly use the labelled synthetic replay. Review the summaries in Discover, then press **Connect observations with AI**.
4. Review the cited explanation and uncertainty. Confirm with a budget to request a product, dismiss it, or enter a correction. Correcting withdraws the old suggestion and requires a new confirmation, even when the replacement response resembles an earlier one.

Without an AI key, Discover explains why synthesis is unavailable. **Show prepared rule-based demo** explicitly selects the deterministic fallback. It is never presented as a live model response. `/tests/fixtures/intent-synthesis.html` tests the actual UI with scripted API responses, an always-visible disclosure and request counters; it is excluded from production build inputs.

## Architecture

| Stage | Owner | Contract |
| --- | --- | --- |
| Capture | Automatic right-click search, panel wishlist and controlled attention producer | Capture, crop, clarification and ranking workflow preserved; opted-in tagless saved context now also reaches memory |
| Bounded snapshot | `IntentStore.synthesisSnapshot()` | Up to 12 source-balanced observations; complete measured, observed or fixture cohort; no raw history or screenshots |
| Synthesis | `POST /intent/synthesize` and `AIIntentSynthesizer` | Explicit action, consent and current fingerprint required; structured hypothesis or abstention; no tools |
| Review | `IntentWorkspace` | Observed facts, proposed need, cited relevance summaries and uncertainty remain distinct; confirm, dismiss or correct |
| Recommendation | Existing guarded intent recommendation route | Confirmed current hypothesis supplies a generic category query and user constraints to the existing search pipeline |

The provider uses AI SDK structured output with a flat strict schema and required nullable fields, matching [OpenAI Structured Outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs). It reuses the existing model/provider configuration, requests no provider storage, and limits retries and output size. No new dependency is required.

Validation rejects unknown or duplicate evidence IDs, fewer than two source identities, missing hypothesis fields, and malformed category queries. A valid abstention contains no hypothesis or search query. Prompts treat source content as untrusted evidence, forbid sensitive-attribute inference, and distinguish attention from shopping intent. These controls verify structure and reference provenance; they do **not** prove that every natural-language inference is semantically justified. User review and live evaluation remain necessary.

## Persistence and stale responses

`intent_syntheses` stores the latest output, model, prompt version, context fingerprint, correction and fresh generation ID. `intent_runtime` tracks consent epochs and a monotonic mutation revision. A fresh result starts tentative; numeric readiness remains a separate heuristic, not model confidence or purchase probability.

Unchanged context, configuration and correction reuse the stored result. Ordinary refresh never invokes the model. Content changes, pause/resume, removal and reset invalidate the matching context; concurrent feedback or mutations reject a pending response. New uncached generations cannot resurrect a previous confirmation. Freshness follows the current content fingerprint: reversing a same-ID action back to the identical prior snapshot may reuse its cached assessment and feedback; removal/re-add, consent changes and new generations do not. A same-context correction carries the user's budget but dismisses the prior hypothesis before calling the provider. Cancellation, timeout or failure cannot silently restore its old product. The product route checks the active confirmed context both before and after search.

## Evaluation before the hackathon

Automated tests and the scripted UI fixture verify contracts, request ordering and error handling. They do not measure live-model reasoning quality. This checkout had no configured provider key during implementation, so no external-model synthesis has been verified here.

With a configured key, rehearse at least: the two article sources; two unrelated subjects; ambiguous or conflicting observations; an ordinary need outside the prepared tags; the “I eat at home” correction; and source text containing embedded instructions. Check that references are accurate, explanations stay tentative, unsupported connections abstain, corrections respect the user's meaning, and zero product requests occur before confirmation. Record the model, prompt version, latency and actual result; do not replace an abstention with a scripted success while describing it as live AI.

Broader cross-site capture, multi-user authentication, retailer sharing, learned intent calibration and live merchant purchasing remain outside this local prototype.

## Recommendation attribution

AI readiness uses commerce actions bound to the exact confirmed hypothesis, carried through the server-saved recommendation session. Wishlist saves resolve the canonical offer from that session; group interest inherits the saved item’s binding, and cart additions resolve it from the search session. A product from an earlier objective cannot make a corrected hypothesis appear ready to buy. This also works when a need has no prepared topic tags. Recommendation-derived commerce is excluded from fresh synthesis evidence.
