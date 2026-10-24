# Needle — See it anywhere, find it on Coupang

## 1. Product fit and goal

**Yes—your idea fits the brief.** It makes AI responsible for identifying a product, evaluating options, and preparing a purchase. For Coupang, the value is turning inspiration elsewhere on the web into a shopping journey on Coupang.

**Pitch:** “Right-click something you want. Needle finds it on Coupang, explains your best options, and prepares your purchase.”

Tonight’s deliverable is a Chrome extension with product discovery, AI recommendations, and clearly simulated checkout. Product categories remain open; exact matches come first, followed by labelled alternatives.

## 2. How to obtain Coupang data

**Coupang has official product-data APIs, but immediate access is the main obstacle.**

| Route | What I verified | Decision |
|---|---|---|
| **Coupang Partners API** | Provides product information, product lists, affiliate links, and reporting. Its published guide requires final approval before API access. | Best official route to investigate with the organizers; do not depend on fresh approval tonight. [Official guide](https://partners.coupangcdn.com/partners-guide/partners-guide-20251028182159.pdf) |
| **Seller Open API** | Queries registered seller products using a seller `vendorId`; also supports seller operations. | Exclude from the shopper-search implementation. [Product-list documentation](https://developers.coupang.com/en/api/products/product-list-paging-query?market=KR) |
| **Exa restricted to Coupang** | Exa supports domain-restricted search and content retrieval. Its shopping demo extracts listing evidence. Coupang coverage remains untested. | First live-discovery approach to test tonight. [Exa search](https://exa.ai/docs/reference/search), [shopping example](https://demos.exa.ai/shopping-demo/how-it-works) |
| **Prepared sample catalog** | Can contain manually reviewed product records from accessible sources, with source links and observation dates. | Reliable demonstration fallback, visibly labelled as sample data. |

The Coupang product-page fetch I attempted was blocked. Therefore, live extraction must pass an early feasibility check. No buyer-facing order-placement API was verified in the inspected documentation.

**Data decision:** spend the first 30 minutes testing Exa against five product queries. Use live discovery if at least three return relevant, source-backed Coupang listings. Otherwise, finish the demonstration using a labelled sample catalog. Never silently replace failed live results with samples.

No organizer resources have been supplied, and no Exa key was available in the current environment for an authenticated test.

## 3. Product requirements

| Requirement | Required behavior tonight |
|---|---|
| **Right-click entry** | Add “Find on Coupang with Needle” to Chrome’s context menu. Open a side panel containing the selected image or text. |
| **Object selection** | For composite images or inaccessible image URLs, offer a screenshot crop so the buyer can identify the intended object. |
| **AI identification** | Extract product type, visible brand/model, color, and distinguishing features. Show an editable interpretation. |
| **Coupang discovery** | Search using identifiable model details first; otherwise use descriptive queries, including Korean search terms. Recommend only Coupang listings. |
| **Match quality** | Label results “Exact match,” “Likely match,” or “Similar alternative.” Visual resemblance alone cannot establish an exact match. |
| **Evaluation** | Show up to three recommendations with a source link, available price, relevant differences, and a short explanation of the recommendation. |
| **Conversational refinement** | Support one contextual follow-up, such as “Find something similar under KRW 50,000.” Preserve the original target. |
| **Currency** | Display the original amount and explicit currency code, such as `KRW ₩49,000` or `USD $39.00`. Do not convert automatically or compare different currencies as though equivalent. |
| **Demo purchase** | Show the selected item, variant, and stated demo terms before “Confirm demo purchase.” Return a demo order reference and “No payment taken.” |
| **Honest missing data** | Display unknown price, availability, shipping, or returns as unknown. Show Rocket Delivery information only when supported by the source; do not infer arrival dates. |

The main recommendation should be prominent, with alternatives beneath it. AI should explain the choice so the buyer does not have to inspect another results grid.

The right-click starts discovery. The final click confirms a prepared demo purchase; ambiguous objects or variants can require additional input.

## 4. Implementation and tonight’s build sequence

**Stack:** Chrome Manifest V3, React and TypeScript for the panel, and a local Node.js/Express backend. Use Exa for retrieval and OpenAI Responses with configurable `gpt-5.6-terra` for image interpretation and structured recommendations. The model supports image input and structured output. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra)

**Data flow:**

`Selected object → vision identification → Coupang search → evidence extraction → ranked recommendations → demo confirmation`

Use one bounded workflow. Keep API keys on the backend, capture page content only following user action, and treat retrieved page text as evidence rather than agent instructions.

**Minimum interfaces:**

- `POST /discover`: selected image/text and preferences → interpreted item and source-backed offers.
- `POST /refine`: previous search context and buyer instruction → updated offers.
- `POST /demo-orders`: selected offer, variant, and confirmation identifier → simulated order. Repeated confirmation returns the same order.

Each offer carries its source URL, match label, nullable price, explicit currency, observation time, and data origin: retrieved listing or sample catalog. Keep retrieval behind a provider interface so organizer data or Partners access can replace Exa later.

| Time budget | Deliverable |
|---|---|
| **First 30 minutes** | Verify credentials and Coupang retrieval; choose live or sample mode using the feasibility gate. |
| **Next 60 minutes** | Complete the extension-to-panel-to-demo-order flow using fixtures. |
| **Next 90 minutes** | Connect image interpretation, search, evidence extraction, and ranking. |
| **Next 60 minutes** | Add crop fallback, contextual refinement, currency labels, and failure states. |
| **Final 60 minutes** | Test three categories, fix failures, and rehearse the presentation. |

Assume roughly five focused hours and familiarity with the stack. Run locally with an unpacked extension. Accounts, real payments, merchant checkout automation, price alerts, and extension-store publication are deferred.

## 5. Acceptance criteria

- Demonstrate headphones, a bag, and a lamp without category-specific search logic.
- Complete capture → recommendation → demo order for all three prepared examples.
- Demonstrate one crop correction and one natural-language refinement.
- Every recommendation has a Coupang source link or an explicit sample-data label.
- Every exact-match claim has identifying evidence.
- Missing information remains unknown; foreign currencies retain their original codes.
- Duplicate confirmation produces one demo order.
- Unsupported pages, no matches, and API failures show useful recovery actions.
- Target a useful recommendation within 30 seconds; show progress and offer retry after a 45-second timeout.
- The presentation clearly distinguishes live discovery, sampled product data, and simulated purchasing.

**Demo story:** a shopper spots an item on an unrelated webpage, asks Needle to find it on Coupang, refines the recommendation, and confirms a demo purchase—all from the side panel.
