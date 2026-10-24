# Verification record — v0.3

Checked on 25 October 2026 (Asia/Singapore).

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
