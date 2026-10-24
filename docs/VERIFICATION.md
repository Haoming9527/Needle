# Verification

Current scope: Needle 0.8.0, checked on 25 October 2026 (Asia/Singapore).

## Ryan review fixes — v0.8 integration

- Integrated main `c9e0439`, including PR #2. Restored main’s exact content script, overlay background, target extraction and toolbar fixture: automatic right-click discovery, three popup actions, On/Off and cancellation remain intact.
- Find is the default/home view. Discover and Saved are optional. Main’s automatic catalog/web search, voice, cart/history reset controls and mutation guards are preserved.
- Extension output contains only `panel.html`; build validation now rejects other HTML pages. Recipe/commute pages remain development-server rehearsal sources. Their opted-in collector runs independently of Discover, not on arbitrary public websites.
- Clear cart now retracts cart-readiness evidence even while memory is paused. New regression cases cover malformed requests, paused consent, repeated clear, and default panel navigation.
- **318 tests in 32 files passed**, plus **14 Logan Node tests**; TypeScript, production build and extension package validation passed. Updated the isolated Logan server fixture to include PR #2’s new decision-client dependency. Live synthesis and installed-Chrome rehearsal remain unverified.


## Automated checks

Latest result: all 197 tests across 18 files pass, and the production build passes TypeScript and extension-package validation.

Run `npm test` and `npm run build` from the repository root. Tests use temporary or in-memory SQLite databases; they do not clear the user's saved data.

- Backend coverage includes catalog search, evidence integrity, original currencies, budgets, clarification history, origin restrictions, persistent cart/history, idempotent purchases, and independent collection resets. Cleared receipt payloads are removed; confirmation identifiers and hashes prevent stale retries from recreating them.
- Extension coverage includes cursor-centered crops, marked vision input, capture races, stable popup positioning, bounded glow, microphone cleanup, and ignored late responses.
- Right-click preferences cover saved Off startup, later re-enabling, native context-menu pass-through, cross-tab persistence, cancellation during capture/search/voice, and opening the side panel while Off without capturing.
- The production package contains only the extension panel, worker, content script, icons, and product images. Standalone presentation pages have been removed. The separate Logan app remains in `logan/` and is excluded from the extension build.

## Browser checks

`tests/fixtures/` exercises actual extension components with mocked Chrome/API boundaries. These pages are for development only and are excluded from the extension build.

- Clear cart and Clear history each empty only their respective fixture collection; empty controls become disabled.
- Preferences show Budget and Currency only. The source mode buttons, connection badge, and explanatory block are absent.
- The header switch persists Off after reload. Manual searches remain usable while Off and send `mode: "sample"` even when the mock backend default is live.
- With Off, the fixture site's right-click handler receives the event and no Needle search starts. Turning On in another tab restores the shopping popup.
- Clarification uses one microphone icon inside the editable answer field; typing remains available if audio fails.
- The small red marker glows during searches, stays clear of the popup, and disappears on completion or cancellation.

## External service checks

Previous authenticated checks verified OpenAI image recognition, Exa product discovery, the Decisions endpoint selecting the requested Sony WH-1000XM5 from reversed candidates, and Speech output transcribed with `gpt-transcribe`. The speech check used generated audio, not the user's microphone.

Native Chrome microphone permissions and audible playback need the user's local smoke test. Browser fixtures do not establish verification of every website or live X behavior. Product inventory, shipping, and real merchant checkout are outside this simulated-purchase extension.

## Earlier Ryan Part 4 verification (before v0.8 integration)

## Ryan Part 4 package — latest-main integration

- Integrated main through `b2d4393` (including voice, Decisions, and the v0.7.3 glow) while preserving explicit Save/Find and Part 4’s consent, correction, and confirmation gates. Resolved all shared-file conflicts on the review branch.
- **301 tests in 30 files passed** on the integrated tree. `npm run build` passed TypeScript, Vite, both extension bundles, and package validation.
- Fixed Saved workspace refresh after another tab saves an item. Readiness now uses the exact server-owned hypothesis attached to a recommendation session, including tagless actions and refine/clarify continuations. Old-need commerce cannot increase a corrected need’s readiness or become new synthesis evidence.
- Added Ryan’s overview, architecture, data contract, demo runbook, integration guide, review backlog, and wiki source under `docs/ryan/`.
- Tests use controlled providers. No actual external-model synthesis, installed Chrome microphone/capture rehearsal, arbitrary cross-site instrumentation, or seller bridge was verified in this package pass. The earlier browser-rehearsal records below retain their original scope and commit context.

## Step 4 AI synthesis (earlier pass at 0ef8b5a)

- Added an explicit provider-backed synthesis stage over at most 12 saved observations. Responses must cite existing evidence from at least two sources or abstain. It has no search tools. The product route still requires current user confirmation; corrections withdraw the old product and require reconfirmation.
- **253 tests in 26 files passed**, including provider structured-output validation, SDK response handling, store persistence, cache behavior, tagless contexts, consent, stale response races, correction budgets, and cancellation even when a provider ignores the abort signal. TypeScript, production Vite/extension build and package validation passed.
- Browser-tested the actual Discover component using the development-only scripted fixture: zero product searches before confirmation; one after confirmation; no repeat on focus refresh; failed correction withdraws the product and preserves editable text; retry returns a tentative corrected need with the budget retained; reconfirmation produces the revised product. Abstention triggers no product search. A completed assessment arriving after an error becomes visible on refresh.
- Inspected the desktop layout and readable input preview. Screenshot `.local/screenshots/ai-synthesis-fixture.png` explicitly shows scripted responses and no external calls. The real panel correctly disables AI synthesis without credentials and shows the prepared rule flow only when explicitly selected. The previous measured-attention rehearsal remains recorded below; it was not represented as live AI synthesis.
- No configured API key was present in this checkout. **Actual external-model synthesis and reasoning quality remain unverified.** Mocked SDK tests and scripted UI responses verify the integration, not model quality. See `AI_SYNTHESIS.md` for the live rehearsal cases.
- This pass does not modify extension capture, the attention collector, product identification, catalog/Exa providers, crop or clarification components. The shared Save hook now admits opted-in bounded context with no prepared topic tag, enabling new topics without changing how capture or search works.

## Earlier team synchronization at 0ef8b5a

- At that check, remote main was `05909ce`; this branch includes it. The latest separate `codex/logan-decision-review` head inspected was `bb5a666`, adding local model services, model cards, an optional Logan decision adapter and tests. These are not integrated into this intent flow; their reported evaluations were not independently reproduced here.
- Synced main through `05909ce`, which removes only eight Logan data/model/report artifacts for separate branch review. Low-intent source, runtime, and tests are unchanged. The earlier artifact review below is historical; those files are no longer in this branch.

## v0.7 measured attention integration

- Added separately opted-in measurement on two registered local reading regions. Actual pointer dwell is captured; article context and topic tags remain prepared data. Existing extension Save / Find, crop, clarification and search relevance were not changed in this pass.
- **210 tests in 23 files passed**, covering ingestion validation, source/capture provenance, separate consent, per-source caps, mixed replay/measured evidence, collector timing and cleanup, and client retry/stale-response handling. TypeScript, production build and extension package checks passed.
- Browser rehearsal used trusted pointer input in the real page regions: recipe dwell measured 2,002ms and produced no hypothesis; commute dwell added a tentative connection. Both observations retained the actual loopback origin, region, session/page IDs and measurement metadata. Navigation did not inject fixture observations.
- Confirming a KRW 30,000 limit returned the KRW 24,000 lunch container; correcting to eating at home returned the KRW 21,000 storage set and retained the budget. Refreshing recorded context left the product stable and the persisted discovery-session count unchanged at 5.
- Desktop and 390px visual inspection passed; mobile document width and scroll width were both 390px. Screenshots: `.local/screenshots/measured-commute-source.png`, `measured-intent-connection.png`, `measured-intent-mobile.png`.
- Removing measured recipe evidence cleared the inline product; measuring replacement evidence required a fresh confirmation.
- Integrated main through `9aaa4d6`. Its eight added Logan files are data/model/report artifacts only; no runtime behavior changed. The agent checked matching report hashes and no exact text overlap between training/validation/evaluation; model performance was not independently reproduced.
- This demonstrates two prepared sources on one local origin. It does not verify arbitrary cross-site collection, stationary pointer attention, installed Chrome behavior, authenticated provider calls, or seller sharing. See `ATTENTION_DATA.md` for the producer contract and boundaries.

## v0.7 low-intent workflow refinement

- Replaced dashboard replay buttons with recipe and commuting article previews, then an explicit observed/inferred/uncertain connection and a confirmation question. Signals remain labelled simulation inputs.
- One product appears inline only after confirmation/correction; no cart or group action is needed. View options reuses the returned search response. The dedicated suggestion endpoint validates consent, confirmation and context before and after search.
- Confirmation is bound to its exact supporting observation pair. Changed or re-added support, including legacy feedback without a binding, requires a new confirmation. Removing supporting context clears the inline product.
- **186 tests in 20 files**, TypeScript, production build and extension package checks passed. New tests prove zero provider calls before confirmation or for stale keys, and rejection of delayed results after correction, dismissal, removal or pause.
- Browser walkthrough: recipe alone shows no suggestion; commuting yields a tentative connection; confirming with a KRW 30,000 budget shows a KRW 24,000 portable lunch container inline. Correcting to home meals replaces it with a KRW 21,000 storage set and keeps the budget. Removing/re-adding the recipe clears the product and requires confirmation again.
- Desktop and 390px visual checks passed with no horizontal overflow. Screenshots: `.local/screenshots/low-intent-browsing.png`, `low-intent-connection.png`, and `low-intent-mobile.png`. The preview remains at the tentative question.
- This pass adds no passive telemetry, provider authentication checks, group-buy changes or seller bridge. The primary rehearsal is documented in `CONNECTED_DEMO.md`.

## v0.7 connected discovery integration

- Integrated team changes through `219a92f`: retailer-neutral search, image fallbacks, editorial photos, crop annotation, clarification, and Logan. Explicit Save/Find choice is preserved.
- All **171 root tests in 18 files** passed. TypeScript, production Vite/extension build and package checks passed. Logan's **13 tests** also passed, including imported teammate tests and additional missing-asset/reversible-event checks.
- New coverage verifies consent, two-source corroboration, non-circular recommendation saves, duplicate-save prevention, collections without score inflation, reversible cart/pledge actions while paused, correction with retained constraints, distinct product sets, and safe nested photo paths.
- Browser-tested with no provider keys and an isolated `.local/connected-demo-review.sqlite`: one source produces no need; the second produces a tentative question; confirmation finds lunch containers; correction finds home storage; wishlist/collection, 2 synthetic participants plus local conditional interest, cart, and a simulated receipt complete. No payment or merchant order occurs.
- Inspected desktop and 390px Discover layouts; document width equalled 390px at that viewport, with no horizontal overflow. Proof: `.local/screenshots/connected-intent-desktop.png` and `connected-intent-mobile.png`. Preview remains on the tentative connection.
- Live passive dwell tracking, installed Chrome/X behavior, authenticated provider calls and real seller data-sharing were not validated in this run. Passive signals are labelled fixtures; the actual cursor Save path is explicit context capture. Logan remains a separate local seller concept. Expired pledge evidence currently needs withdrawal to retract intent.

The sections below are historical teammate verification records; their older control labels and test counts do not describe this integrated version.
