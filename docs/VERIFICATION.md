# Verification record

Checked on 25 October 2026 (Asia/Singapore).

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
## v0.7.3 visible search glow

- Increased the red marker's glow contrast and pulse visibility while retaining its 6px dot, bounded 18px halo, and 20px popup clearance. It remains active during initial and clarification searches, pauses for capture, and disappears on results, questions, errors, or cancellation.
- All 16 content-script checks passed. TypeScript, production build, and extension package validation passed. The browser fixture confirmed the visible glow during loading; preview: `.local/screenshots/needle-search-glow-v073.png`.

## v0.7.2 single microphone control

- Simplified clarification replies in the popup and panel to one icon-only microphone inside the answer field, alongside the existing Search/Send action. Removed the separate playback and voice-button row.
- The microphone switches to a stop/cancel control while active. Editable transcripts, typing, cancellation, and errors remain; the tooltip explains that microphone audio is sent to OpenAI. Backend speech support is retained without automatic playback.
- All 23 content-script and voice-controller checks passed. TypeScript, production build, and extension package validation passed.

## v0.7.1 compact cursor marker

- Reduced the red dot to 6px with a soft, bounded 18px halo. The pulse changes opacity only; there is no expanding ring or spreading blur.
- Popup placement reserves a 20px gap from the clicked point. It chooses the left side near the right edge, or above/below on narrow pages, limiting growth so loading, questions, and results stay clear of the marker.
- All 16 content-script tests passed, including stable placement and height limits on narrow viewports. TypeScript, production build, and extension package validation passed. The browser fixture visually confirmed the smaller glow and separation during loading; preview: `.local/screenshots/needle-glow-v071.png`.

## v0.7 product decisions and voice

- OpenAI's dedicated Decisions API ranks retrieved offers after discovery, refinement, and clarification. It uses the clicked crop/coordinates when available, respects currency-specific budgets, and can reject all candidates. A rejected catalog set triggers the existing Exa path. Failed decisions leave grounded offers intact with a warning and no Best fit badge.
- A real authenticated Decisions request with deliberately reversed headphone candidates selected `sample-sony-xm5` using `gpt-6-luna`, matching the requested Sony WH-1000XM5. No product facts were rewritten.
- A real authenticated Speech request read a saved clarification question with `gpt-4o-mini-tts`. Its generated MP3 was passed to `gpt-transcribe`, which returned “Do you mean the headphones or the lamp?” This check used generated audio, not the user's microphone.
- Both popup and panel offer explicit Listen question and Answer by voice controls. Transcripts remain editable until submitted. Audio is transient; question speech is bound to the saved session. Cancellation, late microphone permission grants, late transcripts, size limits, and track/object-URL cleanup have automated coverage.
- All 178 tests in 17 files passed, as did TypeScript, the production build, and extension package validation for 0.7.0. Existing SQLite data and `.env` credentials were preserved.
- The browser clarification fixture displays the controls and recovers from a simulated voice-service failure while keeping typing available. Native Chrome microphone permissions and audible playback remain for the user's smoke test after reloading the extension and refreshing the webpage.

## v0.6.1 cursor search glow

- Added a red dot with a gently pulsing halo at the original right-click coordinates while discovery or clarification is pending. The marker does not move the popup or intercept pointer input; reduced-motion preference uses a steady glow.
- The marker shares the popup's capture visibility so it is excluded from the screenshot. Results, questions, failures, cancellation, and disposal hide or remove it.
- All 13 content-script tests passed, including marker position near viewport edges, capture visibility, and clarification/error/cancel lifecycle. TypeScript, production build, and extension package validation passed.
- The 0.6.1 native visual check remains for the user after reloading Needle and refreshing the webpage.

## v0.5 editorial photography and loading

- Generated seven realistic photo assets with the built-in image generator and saved them under `public/assets/photos/`; full prompts are indexed in `PHOTO-PROMPTS.md`.
- Rebuilt `demo.html` as The Everyday Edit article with working section navigation, editorial copy, and a discreet right-click shopping hint. Reviewed the actual article at desktop, 390px, and 320px widths.
- Catalog, welcome examples, studio preview, and legacy saved-item image paths now use the generated photos. Existing cart/order records were not rewritten.
- Panel loading includes a scan animation over the selected image, real elapsed time, rotating tips, and Stop. Popup loading retains exactly three action buttons and adds a small animated search lens. Both respect reduced motion; timers stop on completion, error, or cancellation. No fake percentage or completed backend stage is shown.
- Browser preview verified the timer/tip changes and Stop removes the loading component. The popup retains passing content-script tests.
- An actual image-only request using the new headphone photo completed in 11.1 seconds, correctly identified black over-ear headphones with brand/model unknown, and returned three priced catalog alternatives using the new photos.
- All 121 tests, TypeScript, production build, and extension package validation passed. Native Chrome/X verification still requires reloading the installed extension and testing there.
- Screenshots: `.local/screenshots/needle-article-v5.jpg` and `.local/screenshots/needle-loading-v5.jpg`.

## v0.4.1 image fallback

- Missing or broken result photos now use the buyer's selected image/crop, including alternatives and checkout. The popup already uses the selected crop.
- Browser checks against the actual ProductImage component verified missing and broken photos use the selected image, changing the selection updates both, and a working product image remains unchanged. Failed primary and fallback images leave a quiet empty space with no error text or retry loop.
- TypeScript and production extension build passed. No server, database, or image-retention behavior changed.

## v0.4 scope

Needle now searches across retailers. Catalog misses go directly to general Exa search; direct web mode also has no retailer-domain restriction. Product source labels use the originating website, seeded products use Needle catalog, and currencies remain as provided. The existing local database and credentials are preserved.

- All 121 tests in twelve files passed, including unrestricted web retrieval, direct fallback, public source validation, persistent prices, source labels, and INR/CHF/KWD currency cases.
- TypeScript, the production build, and extension-package validation passed for version 0.4.0.
- An authenticated direct-web search for “Fellow Stagg EKG electric gooseneck kettle” returned three source-backed products from Amazon and Costco in 19.7 seconds. Two prices remained unknown; one supported USD 179.95 price was retained. No prepared products were substituted in direct web mode.
- Existing seeded and web-derived catalog records, cart entries, and receipts were retained; no database migration or credential change was required.
- The browser preview displayed the saved mandolin with `sweetwater.com`, an Amazon alternative, and unchanged KRW/USD prices. Screenshot: `.local/screenshots/needle-retailers-v4.jpg`.
- The installed Chrome extension needs reloading and the target page needs refreshing. Native Chrome/X smoke testing remains for the user; the earlier fixture tests do not establish live X verification.

The v0.3 checks below describe the earlier retailer-specific version and are retained as historical evidence.

## v0.3 record

## Automated checks

- TypeScript and production extension build passed.
- Extension package check verified manifest, bundled service worker, panel, inspiration page, and icons.
- 115 tests passed in eleven files: backend flows, mocked AI SDK tool execution, SQLite persistence, Exa fallback and evidence, web-product caching, coverage-gate validation, and Chrome capture/content-script contracts.
- Test coverage includes all three sample categories, evidence punctuation/price integrity, model suffix conflicts, budgets and currencies, missing keys, failed live retrieval without sample fallback, timeouts, variant validation, persistent idempotency, origin restrictions, local image cropping, tab-switch capture races, and stale capture completion.
- Real AI SDK image-only recognition against the configured OpenAI provider succeeded in 10.6 seconds. The input was the prepared microphone artwork with no descriptive text. The agent identified a black desktop microphone, kept brand/model unknown, called the catalog tool, and returned three similar microphone offers with KRW prices from the seed.
- The upgrade preserves the existing .env. Seed catalog searches do not require Exa; unmatched items use the configured Exa key automatically.
- An authenticated request for “Black F-style electric mandolin” completed in 21.5 seconds. Coupang queries yielded no indexed matches; general Exa search returned two source-backed demo records: Ortega Raven F-Style (USD 549.99 retained from evidence) and The Loar LM-549E-BKM (illustrative KRW 1,300,000). Both retained original product URLs and were saved to SQLite.
- A subsequent search through the panel found those cached mandolins with the same prices. Product details displayed the original Sweetwater source and the illustrative-price explanation. This verifies demo fallback, not live Coupang stock or prices.

Backend integration tests require a test runner with loopback socket access. A network-isolated sandbox can fail Supertest requests with EACCES before assertions execute.

## Browser checks

Using the locally running v0.3 interaction fixture:

- Trusted right-click on a covered video selected the video region and suppressed the fixture's own context menu.
- Right-click on ordinary page text immediately displayed Buy / Add to cart / × while discovery was pending.
- Cancel remained available during discovery. Buy and Add to cart became available after a result, and each routed to its expected operation.
- The fixture uses the actual content script with a mocked Chrome runtime and a test-only open shadow root. Production uses a closed shadow root. The fixture is excluded from the extension build.
- Screenshot: `.local/screenshots/needle-toolbar-v3.jpg`.

Using the locally running shopping panel (v0.2 checks retained):

- An actual AI-powered Shure SM7B search returned the seeded price and exact text-supported identity.
- Add to cart saved the selected Black variant in SQLite.
- Quantity changed to two; checkout showed KRW 1,098,000 and created receipt NDL-9415B8CE.
- Checkout removed the purchased cart entry and saved the receipt in History.
- The new receipt and migrated legacy receipts remained visible after the panel reloaded.
- The updated UI uses Find/Cart/History, Coupang merchant labels, and no repeated payment/demo notices; Settings contains the dataset explanation.

Earlier v0.1 checks (retained for context):

- Headphone discovery completed and retained the original Sony target after refining to a similar product under KRW 50,000.
- Headphone demo purchase completed with a simulated receipt.
- Bag purchase required a variant; selecting Navy produced the expected demo receipt.
- Lamp purchase required a variant; selecting White produced the expected demo receipt.
- Crop numeric controls produced a new image selection and cleared the previous description.
- An unrelated description returned no match instead of fabricated sample results.
- The panel rendered at a 390px viewport without horizontal overflow.
- Missing provider credentials disabled live discovery visibly.

## Verification limits

- Browser checks use the web preview and interaction fixture. Chrome capture has automated API contract coverage; the installed v0.3 extension still needs the user's Chrome smoke test after reloading and refreshing the webpage. Actual X behavior is not claimed as verified.
- Actual OpenAI calls were tested for text and image-only catalog discovery; authenticated Exa fallback was tested for the mandolin. Coupang inventory, shipping estimates, and payments were not verified.
- Sample product artwork and commercial terms are illustrative. The sample catalog is not a verified copy of Coupang inventory.
