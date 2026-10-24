# Needle requirements — v0.3

The user's revised scope is a localhost Coupang demo storefront, a right-click shopping overlay across ordinary webpages, a Vercel AI SDK agent, and SQLite persistence. This revision supersedes the earlier X-only injection scope and repeated simulated-purchase notices.

| Area | Required behavior |
| --- | --- |
| Website integration | Intercept right-click in ordinary HTTP(S) top-level documents. Handle X/video control layers, images, CSS backgrounds, canvas, and generic content through capture-phase delegation and a viewport-region fallback. Do not post or access the X API. |
| Three controls | Immediately show a compact Buy, Add to cart, and × toolbar at the cursor. Optional offer and variant selectors appear with results. Keep cancellation available while the shopping actions wait for a result. |
| Automatic discovery | Capture a bounded region around the pointer, hide the popup during capture, send only the crop, and identify/search without a second search click. |
| AI | AI SDK 7 vision interpretation plus a bounded ToolLoopAgent with a read-only catalog tool. API keys remain in .env on the backend. |
| Dataset | Seed 18 illustrative records across headphones, bags, lamps, microphones, boom arms, and laptops. Present Coupang as the demo merchant; keep the dataset explanation in Settings and the README. |
| Exa fallback | When the catalog has no offers, search Coupang then the wider web. Reuse the original interpretation and 45-second deadline. Save web-derived demo items in SQLite with their original reference URL and stable price. |
| Evidence | Agent-selected IDs must exist in tool results. Price, original currency, variants, and offer identity come from catalog records. Visual similarity alone cannot establish exact identity. |
| Web provenance | Product names must appear in retrieved evidence. Preserve explicit source prices and currencies; otherwise assign illustrative KRW prices. Keep original references and illustrative-price explanations in collapsed Product details. Never label general web references as verified Coupang listings. |
| Minimal panel | Find, Cart, History. Compact product information, Buy/Add to cart, optional correction/refinement, and collapsed details. |
| Cart | Persistent entries, variants, quantities, removal, and subtotals grouped by currency. |
| Purchase history | Confirm the reviewed product/quantity; create an idempotent receipt and atomically remove the purchased cart entry. Preserve history across restarts. |
| SQLite | Local database auto-creates/seeds, stores searches for one hour, and migrates old JSON receipts once. No image captures are persisted in the database. |
| Recovery | Clear errors for missing keys/service, ambiguous objects, no matches, cancelled/timeout requests, and failed capture. No silently fabricated live offers. |
| Local runtime | Bind API/preview to loopback. Keep the native Needle context-menu entry as a fallback. Build a reloadable unpacked MV3 extension and reattach content scripts to open ordinary pages after updates. |

## Scope

All purchases are simulated. The demo storefront does not use a payment gateway, Coupang buyer account, or merchant order API. The agent chooses prepared products or adds source-backed web references with illustrative prices where needed. It cannot invent product identity or execute a purchase. Separate live mode remains restricted to Coupang listings.

The approved broad screenshot permission is required by Chrome for the requested automatic gesture. Content injection covers ordinary HTTP(S) top-level pages; capture occurs only after right-click. Shift + right-click and editable fields keep their native menus. Chrome internal pages, the Chrome Web Store, and cross-origin embedded frame contents require another input path; frame-local coordinates must never be reused as top-level screenshot coordinates.

## Validation

- Automated API tests: SQLite restart persistence, catalog seeding, migration, variants, quantity validation, checkout conflict/idempotency, origin checks, and currency handling.
- Mocked AI SDK tests: vision input, actual SDK tool loop, grounded IDs, source evidence, and provider errors.
- Extension tests: crop geometry, tab races, trusted messaging, cancellation, no full screenshot upload, and cached purchase handoff.
- Browser checks: agent result → cart → quantity → purchase → history; X/local right-click popup → cropped recognition → Buy handoff.
- Refer to VERIFICATION.md for completed checks and remaining limits.

