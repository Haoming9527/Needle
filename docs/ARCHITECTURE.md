# Architecture

Needle has two runtime parts: a Chrome extension and a local Express API. The extension owns the gesture, preview, and purchase confirmation. The API owns identification, product retrieval, ranking, and SQLite persistence.

## Follow a right-click

1. [`src/extension/content.ts`](../src/extension/content.ts) intercepts the gesture and renders the three-control popup. Helpers in [`capture/`](../src/extension/capture/) find the visible target and calculate the cursor-centered crop.
2. [`background.ts`](../src/extension/background.ts) is the service-worker entry point declared by the manifest. [`overlay-background.ts`](../src/extension/overlay-background.ts) verifies the tab, captures the crop, sends discovery requests, and handles cancellation and retries. It sends clean and marked crop copies; full-tab pixels are not uploaded.
3. [`server/app.ts`](../server/app.ts) validates the request, supplies dependencies, and saves the search session. [`http/`](../server/http/) owns schemas, local-origin restrictions, the request deadline, and error responses.
4. [`agent/identification.ts`](../server/agent/identification.ts) interprets the selection. [`agent/discovery.ts`](../server/agent/discovery.ts) coordinates catalog retrieval, product decisions, and bounded web fallback. It receives providers, a decision function, and a cache callback rather than owning HTTP or SQLite.
5. [`agent/catalog-agent.ts`](../server/agent/catalog-agent.ts) runs the read-only catalog tool loop. [`agent/product-decision.ts`](../server/agent/product-decision.ts) selects suitable candidates using the original crop and buyer constraints. Unknown brand/model can still produce a similar alternative.
6. The popup displays the recommendation. Buy hands the saved selection to [`src/panel/App.tsx`](../src/panel/App.tsx), which owns panel navigation and search state. Components in [`panel/components/`](../src/panel/components/) render the review, cart, history, crop editor, and voice answer controls.
7. A confirmed cart or purchase action calls the API separately. [`storage/database.ts`](../server/storage/database.ts) owns transactions, persistence, and retry identifiers. Search providers and the agent cannot purchase products.

Manual searches in the panel use [`panel/api.ts`](../src/panel/api.ts) to reach the same backend workflow. Both UI surfaces share [`src/voice/voice-client.ts`](../src/voice/voice-client.ts) for recording and transcription.

## Backend responsibilities

| Folder or file | Owns |
| --- | --- |
| `agent/` | Image/text interpretation, buyer preferences, the catalog tool loop, product decisions, and fallback orchestration |
| `providers/types.ts` | `ProductProvider` and its result contract |
| `providers/catalog.ts` | Deterministic search over supplied catalog records; also powers the agent's catalog tool |
| `providers/web.ts` | Exa-derived catalog records with source provenance and supported or illustrative prices |
| `providers/live.ts` | Direct Exa retrieval, retaining unknown prices as unknown |
| `providers/evidence.ts` | Shared source validation, identifier matching, public image URLs, and price evidence |
| `storage/catalog.ts` | Prepared product records |
| `storage/database.ts` | SQLite schema, sessions, cached web records, cart, receipts, and migration |
| `http/` | Input validation and the HTTP request lifecycle |
| `routes/voice.ts` | Speech and transcription endpoints tied to saved search sessions |
| `config.ts` | Environment-derived configuration; keys never enter browser bundles |
| `app.ts` | Dependency composition and discovery/cart/order route registration |
| `index.ts` | Environment loading, loopback listener, and shutdown |

[`shared/types.ts`](../shared/types.ts) defines browser/server contracts. Shared source labels and recovery-question helpers also live in `shared/`. Avoid importing server code into the extension.

## Where to make changes

- **Prepared products:** edit `server/storage/catalog.ts`. Startup upserts seeds; cached web products and saved purchases remain in SQLite.
- **Identification or recommendation behavior:** use `server/agent/`. Keep source facts in the provider results and validate selected IDs against those results.
- **Another product source:** implement `ProductProvider` in `server/providers/` and supply it from `server/app.ts`. Keep credentials on the server.
- **Capture or cursor targeting:** use `src/extension/capture/`; service-worker capture and messaging remain in `overlay-background.ts`.
- **Popup appearance or interactions:** use `src/extension/content.ts`. Panel-only UI belongs in `src/panel/components/`.
- **Right-click On/Off behavior:** use `src/extension/storage/preferences.ts`.
- **API fields:** update `shared/types.ts`, the matching `server/http/schemas.ts` schema, and consumers together.
- **Persistence:** keep migrations and atomic cart/order operations in `server/storage/database.ts`.

## Development and packaging

`npm run dev` starts the API and Vite panel preview. `npm test` runs the regression suite; `npm run build` checks TypeScript, bundles the extension, and validates its package. Tests use temporary or in-memory databases.

Vite builds `panel.html`; esbuild bundles `src/extension/background.ts` and `src/extension/content.ts`. The manifest and shipped images come from `public/`. Only `dist/extension/` is loaded into Chrome. Browser fixtures under `tests/fixtures/` are development tools and are excluded from that package.

`scripts/check-coverage.ts` and `scripts/lib/coverage.ts` check external retrieval quality when requested; they are not part of the runtime. The hackathon brief lives at [`reference/hackathon.pdf`](reference/hackathon.pdf). Current scope and verification are documented in [requirements](REQUIREMENTS.md) and [verification](VERIFICATION.md).

The repository keeps source, tests, maintenance scripts, and reference documentation. Generated `dist/`, installed `node_modules/`, `.env`, and `.local/` are ignored. Do not delete `.local/` during cleanup: it contains the user's SQLite catalog, cart, and history.
