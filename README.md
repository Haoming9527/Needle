# Needle

**See it anywhere. Find it with Needle.**

A local Chrome extension with a compact right-click shopping popup, a Vercel AI SDK agent, and a SQLite cart and purchase history. Needle searches across stores, using 18 seed products plus product references discovered with Exa. Purchases are simulated; it does not place merchant orders.

The extension uses six generated category photos in `public/assets/photos/`. These are illustrative images, not verified photographs of the named catalog models. Searching shows a small red glow at the selected point, elapsed time, and an available cancel control.

## Run locally

Requires Node.js 22.13+ (tested on 26.12.1).

```powershell
npm install
# Only copy when no .env exists; preserve your existing keys.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

- [Shopping panel](http://127.0.0.1:5173/panel.html)

The API binds to `127.0.0.1:4318`; Vite binds to `127.0.0.1:5173`. Keep them running. For the API alone, use `npm start`.

## AI configuration

Your existing `.env` is preserved. The only required key for the demo agent is:

```dotenv
OPENAI_API_KEY=your_key
EXA_API_KEY=your_exa_key
OPENAI_MODEL=gpt-5.6-terra
NEEDLE_MODE=sample
DATABASE_PATH=.local/needle.sqlite
PORT=4318
```

Use a vision-capable model available to your account. The existing configured model takes precedence over the default. Restart the API after changing `.env`.

Product selection and voice reuse `OPENAI_API_KEY`. Optional overrides (no additional keys required):

```dotenv
OPENAI_DECISION_MODEL=gpt-6-luna
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral
OPENAI_TRANSCRIBE_MODEL=gpt-transcribe
```

The dedicated OpenAI Decisions endpoint chooses the best fit from the retrieved candidates, using the marked cursor crop, identified features, constraints, and clarification replies. Only a successful choice receives **Best fit**. A rejected catalog candidate set can trigger Exa fallback. Missing credentials or a failed decision keep the existing grounded recommendations with a search note; prices, match labels, and merchant facts are never rewritten by the decision.

Alternatively, set `AI_GATEWAY_API_KEY` for identification and catalog search; Decisions and voice require a direct `OPENAI_API_KEY`. The OpenAI key takes priority when both are present. No Vercel deployment is required. `EXA_API_KEY` enables automatic web fallback when the catalog has no close match, including searches started from the right-click popup. Without it, prepared catalog searches still work.

With a key, the agent interprets the selected image, calls a SQLite catalog-search tool, and recommends grounded offers. Without a key, text descriptions still search the prepared catalog; image recognition is unavailable. Keys stay on the backend and are never bundled into the extension.

### When there is no catalog match

Needle searches the wider web directly through Exa for real product references and adds those products to the local demo catalog. There is no preferred retailer or domain restriction. This reuses the identified object within the same 45-second request. Missing credentials or failed services produce a recovery message.

Web-derived demo items show their source website and retain the original reference in **Product details → Original product source**. A verified source price keeps its currency. Otherwise, the agent assigns an illustrative price, marked in Product details. SQLite saves the product, price, and provenance so later searches use the same record. The interface automatically uses catalog search with web fallback; there is no mode picker or connection badge. Direct web retrieval remains available to API clients using `mode: "live"`, with unknown prices kept unknown.

## Load or update the extension

```powershell
npm run build
```

1. Open `chrome://extensions`, enable Developer mode, and load unpacked `E:\01-Projects\Needle\dist\extension`.
2. If Needle is already installed, click its **Reload** control and accept the approved site permission if Chrome requests it.
3. Check that Chrome shows **version 0.8.0**, then refresh the webpage to remove the previous content script.
4. Right-click the object on any ordinary **HTTP/HTTPS webpage**, including X. A floating toolbar appears immediately with **Buy**, **Add to cart**, and **×**.
5. Needle captures a small region around the cursor, marks the exact point for vision, and automatically searches. A red glow stays at the clicked point while searching and disappears when the search ends. It hides during capture and respects reduced motion. Its two shopping actions become available when a result and any required variant are ready. If the agent asks which object you mean, type your answer directly in the popup and press Enter or Search.
6. **Buy** opens the side panel to review and confirm. **Cart** and **History** are available from the panel navigation.

Shift + right-click preserves the normal browser menu, as does right-clicking an editable field. The native **Find with Needle** entry remains a fallback. Images, video-control overlays, CSS backgrounds, canvas drawings, and ordinary page areas all open the custom toolbar. The popup stays anchored through loading and results. Clarification replies in either the popup or panel reuse the original frame; manual crop/description controls remain available.

Use the panel's **On/Off switch** to enable or disable right-click shopping. Off restores the normal browser/site context menu and closes an active shopping popup. The preference is saved across tabs and browser restarts. Open Needle from Chrome's extension toolbar to turn it back on. Settings now contains just the budget and currency preferences.

If Chrome still shows only its normal menu, verify version 0.8.0, enable Needle's site access for the page, and refresh that page. Browser-internal pages, the Chrome Web Store, and embedded cross-origin frame contents cannot use this top-document toolbar. Open an embedded player directly or use the native Needle menu and manual crop.

When a product photo is missing or fails to load, recommendations, alternatives, and their checkout use your selected image or crop as the fallback. The selected image stays in the current browser flow; it is not added to the stored catalog as a merchant photo.

### Voice answers

When Needle asks a clarification question, click the small **microphone icon inside the answer field** to record a reply. Allow microphone access when Chrome asks, speak, then click the same button (now a stop icon). Review or edit the transcript and press **Search** in the popup or **Send answer** in the panel. Transcription never submits an answer or purchases anything automatically.

Recording starts only after the microphone button is clicked, stops after 30 seconds, and is cancelled when the question is closed or replaced. Audio is sent through the local backend to OpenAI and held only in memory; it is not written to SQLite. Typing remains available when a page blocks microphone access. The popup and panel each use one microphone control; the Speech endpoint remains available on the backend without a separate playback button.

Technical lifecycle note: this prototype uses OpenAI's Speech endpoint with `gpt-4o-mini-tts`, currently scheduled to retire on 6 January 2027. Migrating to Realtime speech requires an integration change, not just a model-name substitution. See the [speech guide](https://developers.openai.com/api/docs/guides/text-to-speech).

### Browser permission

Chrome's screenshot API requires `<all_urls>` for capture initiated by a webpage right-click rather than an extension-menu invocation. This expanded permission was explicitly approved. Content scripts now run in ordinary HTTP(S) top-level pages, as requested, and updates reattach them to open pages. No screenshots are captured until a user gesture. There is no ongoing feed scraping, X API access, posting, liking, or account automation.

The popup is visible immediately, then briefly hidden during capture. Only a region of up to 320 × 320 CSS pixels, clipped to the visible media when detected or otherwise to the viewport, reaches the backend. Vision receives a marked copy with a target ring and exact normalized cursor coordinates, including near image edges; the shopper sees the clean crop. Replies reuse these images rather than recapturing a moving video. Tab switches, navigation, cancellation, and changed geometry invalidate capture. Raw full-tab pixels are transient. Neither crop copy is saved in SQLite. The manual crop fallback retains its screenshot only in extension session storage. Video protections may produce a black frame; use a description in that case.

## SQLite and the agent

`.local/needle.sqlite` is created and seeded automatically. It stores seeded and web-derived catalog records, search interpretations for one hour, cart items, and purchase receipts. Raw image captures are excluded. Selected source-page metadata is retained with its search; general browsing history is not collected.

The seed includes headphones, bags, lamps, podcast microphones, boom arms, and laptops. Prices and variants are illustrative. Seed records show **Needle catalog**, while sourced products show their original website. Collapsed Product details retains provenance. Edit `server/catalog.ts` to change fixtures; startup upserts the seeded records.

**Clear cart** removes every saved cart entry; **Clear history** removes the local purchase receipts. Each button affects only its own collection. Catalog products and API credentials remain available. Clearing history keeps only confirmation identifiers and request hashes to reject stale purchase retries, without retaining deleted receipt payloads.

The agent uses AI SDK 7 `ToolLoopAgent` with a bounded read-only catalog-search tool. It cannot place orders or change the cart. Catalog output IDs must come from tool evidence. The web fallback validates product names against retrieved excerpts, keeps original source links, and saves any illustrative price before use. Checkout is a separate explicit user action. Repeated confirmation IDs return one receipt. Cart checkout and removal happen in one SQLite transaction.

Existing `.local/demo-orders.json` receipts are imported once without changing the original file. Currency amounts remain in their original currency; totals are grouped by currency.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Agent/configuration status; no secret values |
| `POST /discover` | Interpret selected content and recommend items |
| `POST /refine` | Search again while preserving the original target |
| `POST /clarify` | Answer a pending question and re-identify the original crop |
| `POST /voice/question` | Speak the pending question from its saved session |
| `POST /voice/transcribe` | Transcribe a short recording into an editable reply |
| `GET /cart`, `POST /cart` | Read cart or add a reviewed offer |
| `POST /cart/clear` | Empty the cart; strict empty JSON body `{}` |
| `POST /cart/:id/quantity` | Update quantity |
| `POST /cart/:id/remove` | Remove an entry |
| `GET /orders`, `POST /orders` | Read history or confirm a purchase |
| `POST /orders/clear` | Clear purchase history; strict empty JSON body `{}` |
| `POST /demo-orders` | Backwards-compatible purchase endpoint |

## Checks

```powershell
npm test
npm run build
```

See [verification](docs/VERIFICATION.md) and [requirements](docs/REQUIREMENTS.md). `tests/fixtures/` contains development-only previews of actual extension components; these are excluded from the extension build.

Optional direct web retrieval uses Exa and source-evidence checks; run `npm run check:coverage` before presenting it. It never silently switches to fixtures. Inventory verification and real merchant checkout are outside this demo.

Technical references: [AI SDK agents](https://ai-sdk.dev/docs/agents/building-agents), [Chrome screenshot permission](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab), [Node SQLite](https://nodejs.org/api/sqlite.html).
