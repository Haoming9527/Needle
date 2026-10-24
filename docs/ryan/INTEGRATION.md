# Integration contract

[Part 4 home](README.md) · [Architecture](ARCHITECTURE.md) · [Review](REVIEW.md)

**Scope:** Ryan — Part 4: Context to intent owns the opt-in attention-to-context-to-confirmed-need layer. Existing capture, product search, result/voice UI, and seller/model work remain shared-team or teammate areas. This is a reviewable pre-merge package, not a declaration that those other parts belong to Ryan.

| Boundary | Contract to preserve |
| --- | --- |
| Cursor → context | Right-click automatically discovers products and retains Buy / Add to cart / ×. Ambient attention is a separate opt-in collector; it does not depend on manually saving or opening Discover. |
| Context → synthesis | Server-selected bounded snapshot, current context key, at least two supported sources, explicit action; no discovery tools. |
| Synthesis → user | Evidence IDs, uncertainty, model/rule provenance, abstention, confirmation and correction controls. |
| User → discovery | Confirm the current hypothesis; server derives query and constraints. Changed evidence/feedback invalidates previous results. |
| Discovery → result UI | Reuse existing response/offer contracts and price provenance. Preserve existing explicit search and clarification. |
| Part 4 → seller systems | No bridge currently. A future adapter needs explicit consent scope, stable product IDs, signal semantics, and an agreed schema. |

## Merge and release sequence

1. Review the package branch against latest main. Resolve shared `server/app.ts`, panel, extension, config, and documentation changes with the owners; do not replace teammate features wholesale.
2. Preserve main’s newer product decision and voice changes while retaining Part 4’s consent, current-context, confirmation, and cancellation gates.
3. Run focused attention/synthesis/recommendation tests, then the normal full checks. Inspect built extension assets and ensure no credentials or rehearsal data are staged.
4. Rehearse installed Chrome and a real AI request. Verify a correction hides the old product immediately and the replacement needs confirmation.
5. Update the PR and verification record with actual results. Merge/publish only through the team’s agreed review flow; wiki publication and repository merge are separate actions.

## Proposed seller bridge, not implemented

Do not send raw cursor traces or full browsing history to a seller. A future contract could carry a user-confirmed need, allowed constraints, matched product ID, timestamp, and explicit signal type. Define withdrawal and deduplication semantics before connecting it to analytics. Attention, confirmed need, wishlist, cart, and purchase must not collapse into one “conversion” metric.

Logan’s PR #2 supplies local model/service experiments and an optional decision adapter. It does not yet wire Part 4 observations into seller ranking or live commerce. That integration requires a separate reviewed change.
