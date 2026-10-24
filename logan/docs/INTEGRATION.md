# Logan integration boundary

Logan is a standalone local demo on port 4320. The main Needle API runs separately on port 4318. Logan does not implement the extension, cursor collection, cross-site intent scoring, collections, group campaigns, checkout, or seller-account connectivity.

## Existing endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /api/state` | Prepared products, sample/imported evidence, local marks, URL mappings, summary |
| `POST /api/rank` | `{query, weights, productId?}` ranks local content |
| `POST /api/discover` | `{query, mode?, weights?}` explicitly queries main Needle `/discover`, adapts offers, and ranks listing evidence |
| `POST /api/events` | `{recordId, action, attribute, remove?}` upserts or removes a local mark |
| `GET /api/insights?productId=...` | Aggregate local action/reason/source counts |
| `POST /api/listings` | `{productId, url, remove?}` stores a product URL mapping; does not crawl or contact the merchant |
| `POST /api/import` | `{records}` imports at most 200 validated records with `Authorization: Bearer <LOGAN_IMPORT_TOKEN>` |

Event actions are `convinced`, `group_interest`, `buy_intent`, and `explore`. Each record/action pair has at most one current mark. These marks represent one local workspace, not unique customers, orders, conversion, or purchase probabilities.

Imported records require `id` beginning `team-`, `productId`, `title`, `text`, HTTP(S) `url`, and `kind` (`review` or `listing`). Optional `platform` and `creator` are display metadata. The server checks URL syntax but does not verify source claims or retrieve those URLs. Imported content is labelled `imported`; prepared reviews and authors are fictional examples.

## Persistence and access

`LOGAN_DATA_DIR` defaults to ignored `logan/data/`. Its `workspace.json` contains local marks, mappings, and imported evidence. It is independent from Needle's SQLite database. Server binds to loopback and checks Host and Origin. Import token is configured server-side. This is not production multi-user authorization.

`NEEDLE_API_URL` defaults to `http://127.0.0.1:4318`; only explicit connected-search requests invoke it. Tests do not invoke connected search or external services. The forwarded request carries selection text and sample/live mode, not a browsing history or raw screenshots.

## Future integration work (not implemented here)

1. Map Logan's broad product IDs to Needle's actual offer IDs before joining data.
2. Feed confirmed preferences into HookRank; retain Needle's separate intent confidence/readiness scores.
3. Route real saves and conditional group pledges through the main commerce API. A Logan group-interest mark has no budget, currency, expiry, participant count, or threshold.
4. Preserve source provenance, revocation, and independent permission to share browsing-derived information. Do not automatically copy private cursor evidence into seller exports.
5. Connected discovery results currently render separately and are not eligible for `/api/events` unless explicitly imported and mapped. No automatic synchronization is provided.

The seller view displays local summaries and saved URLs. It is not a retailer integration and performs no seller messaging, ordering, payment, or crawling.
