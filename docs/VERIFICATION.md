# Verification record — v0.2

Checked on 25 October 2026 (Asia/Singapore).

## Automated checks

- TypeScript and production extension build passed.
- Extension package check verified manifest, bundled service worker, panel, inspiration page, and icons.
- 76 tests passed in seven files: backend flows, mocked AI SDK tool execution, SQLite persistence, live-provider evidence, coverage-gate validation, and Chrome capture contracts.
- Test coverage includes all three sample categories, evidence punctuation/price integrity, model suffix conflicts, budgets and currencies, missing keys, failed live retrieval without sample fallback, timeouts, variant validation, persistent idempotency, origin restrictions, local image cropping, tab-switch capture races, and stale capture completion.
- Real AI SDK image-only recognition against the configured OpenAI provider succeeded in 10.6 seconds. The input was the prepared microphone artwork with no descriptive text. The agent identified a black desktop microphone, kept brand/model unknown, called the catalog tool, and returned three similar microphone offers with KRW prices from the seed.
- The upgrade preserves the existing .env; Exa is not required for this demo catalog. Authenticated live Coupang coverage is not claimed.

Backend integration tests require a test runner with loopback socket access. A network-isolated sandbox can fail Supertest requests with EACCES before assertions execute.

## Browser checks

Using the locally running v0.2 preview in the browser:

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

- Browser checks use the web preview. Chrome context-menu capture has automated API contract coverage; the installed extension still needs an actual Chrome smoke test.
- Actual OpenAI calls were tested for text and image-only catalog discovery. No live Exa listings, inventory, shipping estimates, or Coupang payments were tested.
- Sample product artwork and commercial terms are illustrative. The sample catalog is not a verified copy of Coupang inventory.
