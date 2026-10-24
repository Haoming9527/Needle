# Needle

**See it anywhere. Find it on Coupang.**

A local Chrome extension with a compact right-click shopping popup, a Vercel AI SDK agent, and a SQLite cart and purchase history. This version presents a **Coupang demo storefront** backed by 18 seed products plus product references discovered with Exa. It does not place merchant orders.

## Run locally

Requires Node.js 22.13+ (tested on 26.12.1).

```powershell
npm install
# Only copy when no .env exists; preserve your existing keys.
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

- [Shopping panel](http://127.0.0.1:5173/panel.html)
- [X-style video interaction fixture](http://127.0.0.1:5173/x-demo.html)
- [Inspiration page](http://127.0.0.1:5173/demo.html)

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

Alternatively, set `AI_GATEWAY_API_KEY`; the OpenAI key takes priority when both are present. No Vercel deployment is required. `EXA_API_KEY` enables automatic web fallback when the catalog has no close match, including searches started from the right-click popup. Without it, prepared catalog searches still work.

With a key, the agent interprets the selected image, calls a SQLite catalog-search tool, and recommends grounded offers. Without a key, text descriptions still search the prepared catalog; image recognition is unavailable. Keys stay on the backend and are never bundled into the extension.

### When there is no catalog match

Needle first searches Coupang through Exa. If no matching listing is indexed, it searches the wider web for real product references and adds those products to the local demo catalog. This reuses the identified object within the same 45-second request. Missing credentials or failed services produce a recovery message.

Web-derived demo items retain the original reference in **Product details → Original product source**; they are not verified Coupang inventory. A verified source price keeps its currency. Otherwise, the agent assigns an illustrative KRW price, marked in Product details. SQLite saves the product, price, and provenance so later searches use the same record. The separate **Coupang live** mode stays restricted to verified Coupang source URLs and never substitutes demo records.

## Load or update the extension

```powershell
npm run build
```

1. Open `chrome://extensions`, enable Developer mode, and load unpacked `E:\01-Projects\Needle\dist\extension`.
2. If Needle is already installed, click its **Reload** control and accept the approved site permission if Chrome requests it.
3. Check that Chrome shows **version 0.3.0**, then refresh the webpage. This first refresh removes the old 0.2 content script.
4. Right-click the object on any ordinary **HTTP/HTTPS webpage**, including X. A floating toolbar appears immediately with **Buy**, **Add to cart**, and **×**.
5. Needle captures a small region around the cursor and automatically searches. Its two shopping actions become available when a result and any required variant are ready.
6. **Buy** opens the side panel to review and confirm. **Cart** and **History** are available from the panel navigation.

Shift + right-click preserves the normal browser menu, as does right-clicking an editable field. The native **Find on Coupang with Needle** entry remains a fallback. Images, video-control overlays, CSS backgrounds, canvas drawings, and ordinary page areas all open the custom toolbar. Ambiguous selections can be cropped or described in the panel.

If Chrome still shows only its normal menu, verify version 0.3.0, enable Needle's site access for the page, and refresh that page. Browser-internal pages, the Chrome Web Store, and embedded cross-origin frame contents cannot use this top-document toolbar. Open an embedded player directly or use the native Needle menu and manual crop.

### Browser permission

Chrome's screenshot API requires `<all_urls>` for capture initiated by a webpage right-click rather than an extension-menu invocation. This expanded permission was explicitly approved. Content scripts now run in ordinary HTTP(S) top-level pages, as requested, and updates reattach them to open pages. No screenshots are captured until a user gesture. There is no ongoing feed scraping, X API access, posting, liking, or account automation.

The popup is visible immediately, then briefly hidden during capture. Only a region of up to 480 × 480 CSS pixels, clipped to the visible media when detected or otherwise to the viewport, reaches the backend; tab switches, navigation, cancellation, and changed geometry invalidate capture. Raw full-tab pixels are transient. The manual crop fallback retains its screenshot only in extension session storage. Video protections may produce a black frame; use a description in that case.

## SQLite and the agent

`.local/needle.sqlite` is created and seeded automatically. It stores seeded and web-derived catalog records, search interpretations for one hour, cart items, and purchase receipts. Raw image captures are excluded. Selected source-page metadata is retained with its search; general browsing history is not collected.

The seed includes headphones, bags, lamps, podcast microphones, boom arms, and laptops. Prices and variants are illustrative. The UI labels these as Coupang products within the demo; Settings explains the dataset and collapsed evidence retains provenance. Edit `server/catalog.ts` to change fixtures; startup upserts the seeded records.

The agent uses AI SDK 7 `ToolLoopAgent` with a bounded read-only catalog-search tool. It cannot place orders or change the cart. Catalog output IDs must come from tool evidence. The web fallback validates product names against retrieved excerpts, keeps original source links, and saves any illustrative price before use. Checkout is a separate explicit user action. Repeated confirmation IDs return one receipt. Cart checkout and removal happen in one SQLite transaction.

Existing `.local/demo-orders.json` receipts are imported once without changing the original file. Currency amounts remain in their original currency; totals are grouped by currency.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Agent/configuration status; no secret values |
| `POST /discover` | Interpret selected content and recommend items |
| `POST /refine` | Search again while preserving the original target |
| `GET /cart`, `POST /cart` | Read cart or add a reviewed offer |
| `POST /cart/:id/quantity` | Update quantity |
| `POST /cart/:id/remove` | Remove an entry |
| `GET /orders`, `POST /orders` | Read history or confirm a purchase |
| `POST /demo-orders` | Backwards-compatible purchase endpoint |

## Checks

```powershell
npm test
npm run build
```

See [verification](docs/VERIFICATION.md), [requirements](docs/REQUIREMENTS.md), and the [presentation guide](docs/DEMO.md).

Optional live Coupang retrieval uses Exa and source-evidence checks; run `npm run check:coverage` before presenting it. It never silently switches to fixtures. Live inventory and real Coupang checkout are outside this demo.

Technical references: [AI SDK agents](https://ai-sdk.dev/docs/agents/building-agents), [Chrome screenshot permission](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab), [Node SQLite](https://nodejs.org/api/sqlite.html).
