# Needle requirements — v0.8

The user's revised scope is a retailer-neutral localhost shopping experience, a right-click overlay across ordinary webpages, a Vercel AI SDK agent, and SQLite persistence. This revision removes the original retailer restriction. Any source currency is acceptable and must remain explicit.

| Area | Required behavior |
| --- | --- |
| Website integration | Intercept right-click in ordinary HTTP(S) top-level documents. Handle X/video control layers, images, CSS backgrounds, canvas, and generic content through capture-phase delegation and a viewport-region fallback. Do not post or access the X API. |
| Three controls | Immediately show a compact Buy, Add to cart, and × toolbar near the cursor. Keep its anchor fixed through loading, questions, and results; clamp on viewport resize. Optional offer and variant selectors appear with results. Keep cancellation available while the shopping actions wait for a result. |
| Automatic discovery | Capture up to 320 × 320 CSS pixels around the pointer, hide the popup during capture, and identify/search without a second search click. Send vision the clean crop as primary evidence and a target-marked reference with exact normalized cursor coordinates, including off-center points near edges. Keep the shopper's preview unmarked. |
| Clarification | Unknown brand/model still proceeds to a suitable product search. Ask only when the intended object is unclear or no suitable product remains after catalog and configured web search. Accept a typed or transcribed answer in the popup or panel. Re-identify the same original crop using the saved question and reply, preserving up to five exchanges. Keep answers on error, block duplicate submission, and support cancellation without late results returning. |
| AI | AI SDK 7 vision interpretation plus a bounded ToolLoopAgent with a read-only catalog tool. OpenAI Decisions chooses the most suitable retrieved candidate without rewriting its facts. API keys remain in .env on the backend. |
| Voice replies | One microphone icon inside the answer field records a short reply for OpenAI transcription. Keep transcripts editable before submission; stop recording and discard late responses when cancelled. |
| Dataset | Seed 18 illustrative records across headphones, bags, lamps, microphones, boom arms, and laptops. Present these as Needle catalog items; keep provenance in Product details and the dataset explanation in the README. |
| Exa fallback | When the catalog has no offers, search the wider web directly. Do not restrict to or prefer a retailer. Reuse the original interpretation and 45-second deadline. Save web-derived demo items in SQLite with their original reference URL and stable price. |
| Evidence | Agent-selected IDs must exist in tool results. Price, original currency, variants, and offer identity come from catalog records. Visual similarity alone cannot establish exact identity. |
| Web provenance | Product names must appear in retrieved evidence. Preserve explicit source prices and currencies; otherwise assign illustrative prices only in catalog mode. Display the source website, not an invented merchant. Keep original references and illustrative-price explanations in collapsed Product details. |
| Minimal panel | Find, Cart, History. Compact product information, Buy/Add to cart, optional correction/refinement, and collapsed details. |
| Engaging loading | Show a small glowing red dot at the selected point, separated from the stable popup. Animate the selected image and a compact popup lens, show actual elapsed time, rotate useful tips, retain cancellation, and respect reduced motion. Do not invent backend progress or completion percentages. |
| Cart | Persistent entries, variants, quantities, removal, and subtotals grouped by currency. |
| Purchase history | Confirm the reviewed product/quantity; create an idempotent receipt and atomically remove the purchased cart entry. Preserve history across restarts. |
| Saved-data reset | Clear cart and Clear history independently on explicit user click. Persist the reset, retain catalog data, and prevent stale confirmations from recreating removed history. |
| Right-click switch | Save the On/Off preference across tabs and restarts. Off restores native right-click behavior and cancels popup capture/search/voice; the extension toolbar can reopen the panel to enable it. |
| Simple settings | Automatically use catalog search plus web fallback. Hide discovery mode buttons, connection badges, and technical explanations; retain budget and currency preferences. |
| SQLite | Local database auto-creates/seeds, stores searches for one hour, and migrates old JSON receipts once. No image captures are persisted in the database. |
| Recovery | Clear errors for missing keys/service, ambiguous objects, no matches, cancelled/timeout requests, and failed capture. No silently fabricated live offers. |
| Local runtime | Bind API/preview to loopback. Keep the native Needle context-menu entry as a fallback. Build a reloadable unpacked MV3 extension and reattach content scripts to open ordinary pages after updates. |

## Scope

All purchases are simulated. The storefront does not use a payment gateway, retailer account, or merchant order API. The agent chooses prepared products or adds source-backed web references with illustrative prices where needed. It cannot invent product identity or execute a purchase. Direct web mode uses retrieved product evidence and keeps missing prices unknown.

The approved broad screenshot permission is required by Chrome for the requested automatic gesture. Content injection covers ordinary HTTP(S) top-level pages; capture occurs only after right-click. Shift + right-click and editable fields keep their native menus. Chrome internal pages, the Chrome Web Store, and cross-origin embedded frame contents require another input path; frame-local coordinates must never be reused as top-level screenshot coordinates.

## Validation

- Automated API tests: SQLite restart persistence, catalog seeding, migration, variants, quantity validation, checkout conflict/idempotency, origin checks, and currency handling.
- Mocked AI SDK tests: vision input, actual SDK tool loop, grounded IDs, source evidence, and provider errors.
- Extension tests: crop geometry, tab races, trusted messaging, cancellation, no full screenshot upload, and cached purchase handoff.
- Browser checks: agent result → cart → quantity → purchase → history; X/local right-click popup → cropped recognition → Buy handoff.
- Refer to VERIFICATION.md for completed checks and remaining limits.

