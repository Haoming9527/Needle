# Verification record

Checked on 25 October 2026 (Asia/Singapore).

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
