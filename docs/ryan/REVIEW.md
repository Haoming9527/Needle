# Readiness and review backlog

[Part 4 home](README.md) · [Demo](DEMO.md) · [Shared verification ledger](../VERIFICATION.md)

Review snapshot: 25 October 2026. The integrated tree passes **301 tests in 30 files**, TypeScript, the production build, and extension package validation. This document separates implementation from independent runtime verification; it does not certify a deployment.

| Priority | Remaining work | Completion evidence |
| --- | --- | --- |
| Before merge | Review final integrated diff and capture validation evidence | Voice, glow, Decisions, and Save/Find preserved; final checks recorded by integrator |
| Before demo | Run synthesis with an actual configured model and realistic latency | Observed hypothesis or abstention, grounded citations, successful correction; no key exposure |
| Before demo | Rehearse installed Chrome capture/search/clarification and voice | Manual run against built extension; native mic/audio checked where presented |
| Before demo | Verify result withdrawal on pause, removal, reset, correction, and delayed responses | Focused tests plus one visible rehearsal |
| Before claiming cross-site support | Generalize controlled source registration and extraction | Real independently hosted pages, clear permission model, semantically grounded context |
| Before claiming validated recommendations | Evaluate irrelevant/ambiguous observations and false connections | Labelled held-out cases, abstention and error analysis; no purchase-probability claims |
| Before seller integration | Agree product identity and consent/withdrawal contracts | End-to-end adapter tests using real agreed schemas |

## What exists locally

The integrated package preserves the latest voice, glow, Decisions, and Save/Find UI. Saved-item focus refresh is fixed. Purchase-readiness attribution now binds to the exact server-owned hypothesis through the recommendation session, supports tagless cart actions, and excludes actions from an old objective.

Part 4 has measured attention, consent-gated local context, an explicit structured AI synthesis path, evidence checks, abstention, correction, and confirmation-gated discovery. Automated tests cover provider/output validation and stale-result rejection with controlled providers. Those tests establish behavior under the tested conditions; they do not verify live model quality or credential availability.

The existing cursor/search workflow remains a core team feature. Latest main reviewed at `b2d4393` includes newer voice work (`be51cdb`); its integrated behavior has passing automated checks on the package branch, with live rehearsal still pending. Saved items/collections and simulated group interest are supporting features, not proof of purchases, multi-user adoption, or a seller integration.

## Additional supporting-flow follow-ups

- **Cart timeout/retry:** investigate duplicate action handling when the client times out after the server accepts a cart request.
- **Saved-item reopening:** add a direct Find/Buy handoff from saved products; current controls cover collection, group interest, and removal.
- **Group expiry:** retract expired group-interest evidence from readiness automatically. Withdrawal already retracts it. Group participation remains a local simulation, not a purchase.

These are supporting-flow backlog items; they should not be represented as finished by the Part 4 tests.

## Logan’s separate PR #2

Reviewed remote snapshot: `bb5a666` on `codex/logan-decision-review`. It adds a local decision service, E5-based experiments, and an optional `/api/decision` adapter. The existing seller workspace and lexical ranking remain separate from Part 4. No observed wiring sends cursor/context observations into this service or replaces the existing `/api/rank` and `/api/discover` flow with learned ranking.

The supplied evaluation uses synthetic data. The E5 path uses frozen pretrained representations with trained classifier heads; semantic ranking uses embedding similarity. The CLM experiment trains a projection head over a frozen base model, not the whole base model. Repository metrics are experiment reports, not independently reproduced customer-performance results.

Runtime prerequisites remain material: the local model environment/cache and running service were unavailable in the reviewed root checkout. Lightweight policy/adapter tests can pass without downloaded weights. Do not advertise that as a successful live model run.

One concrete follow-up: ranking accepts long candidate text while tokenization caps model input at 256 tokens, without a ranking truncation indicator. Surface or constrain this limit before relying on long descriptions. Seller counters also represent local demo signals, not verified unique customers or completed purchases. Neither path executes live commerce.
