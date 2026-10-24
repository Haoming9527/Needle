# Connected intent demo

This demo starts with everyday activity, before a shopping request. It measures cursor time within two controlled reading regions and asks AI to connect their bounded, prepared content context. Both sources share a local origin; arbitrary cross-site tracking is not implemented. A synthetic replay remains available as an explicit fallback.

## Primary workflow: low-intent coordination

The main demo ends after one relevant suggestion. Collections, group buying and the seller workspace are later extensions, not prerequisites for this story.

1. Open **Discover**, then open the meal-preparation reading page. Enable cursor attention; this also enables local context memory. The page clearly distinguishes measured timing from prepared content.
2. Read **Three lunches you can prepare on Sunday** with the pointer inside its marked reading region for at least two seconds. The status confirms measured region dwell. No product search occurs and no need is inferred from this one source.
3. Follow the link to **Making your weekday bike commute easier** and spend two seconds inside its marked region. Navigation itself records nothing. Return to Needle to see the two measured sources. The original panel refreshes on focus, with a manual refresh available.
4. Expand **Review what AI will receive**, then choose **Connect observations with AI**. Show **observed clues → a possible connection → why these observations connect → what remains uncertain**. Numbered references point to the actual stored evidence. The model may suggest carrying prepared food on a commute, or abstain if it cannot support a connection. Two sources do not guarantee a need; cursor timing does not prove habits or willingness to buy.
5. **Yes, that fits** confirms the useful need, optionally with a budget. Only then does the server permit a context-led product suggestion. One suitable catalog result appears inline with a short explanation. Purchase readiness remains Exploring.
6. Enter **I eat at home** under **Correct the connection**, then choose **Reconsider with AI**. This immediately withdraws the previous suggestion and retains the budget. The new hypothesis must be confirmed before another product search. A failed correction leaves the previous product withdrawn and the correction editable for retry. **Dismiss** produces no product recommendation. The prepared rule fallback retains its original one-click correction.
7. Expand **Review context** to inspect provenance and the separate heuristic readiness score, pause memory, remove a clue, or reset. Removing supporting evidence invalidates its confirmation. New evidence needs a new check with the user.
8. **View options** is an optional handoff to the existing Find page using the already-returned result. It does not repeat discovery.

## Boundaries

- Measured demo events retain `demo_fixture` provenance for their prepared semantics, plus `capture.method: measured_cursor`. Synthetic replay has no capture metadata; actual right-click actions remain `observed`.
- The extension still captures explicit selections. The new collector runs only on the registered local demo pages and measures region dwell, including movement within the region. It does not establish stationary attention, reading comprehension or a purchase desire.
- Browser-page text and inferred needs are uncertain evidence. The user can confirm or correct a hypothesis.
- Context is stored locally. Choosing AI synthesis sends a bounded projection of saved summaries and any correction to the configured provider. No retailer data-sharing integration is represented.
- Group-buy interest is conditional and does not place an order or join an external buying group.

## Visual references

These patterns were reviewed via Mobbin and adapted to Needle's context flow, not copied as complete screens:

- [ZARA wishlist](https://mobbin.com/screens/51153b34-429f-4b9f-97cc-bb261245612c): clear named content and an airy card layout, avoiding a dense control dashboard.
- [AirOps recommended prompts](https://mobbin.com/screens/ae0f151a-f195-43ba-9f2f-9c3ff74bfa10): one prominent question, supporting source chips and nearby accept/dismiss controls.
- [Base44 activity panel](https://mobbin.com/screens/88d67865-b72e-4ce6-9e33-272cd9063b3b) and [Gumloop activity](https://mobbin.com/screens/200aea49-95f5-44c3-872d-13ee256af405): compact source rows and restrained status indicators for the new measurement surface.
- [Variant evidence layout](https://mobbin.com/screens/42d49819-409e-47cd-9614-f0266711069a): two adjacent evidence cards make the connection between otherwise separate moments visible.

The key demo reveal now reads visually as two source cards → one tentative question → user confirmation or correction. Detailed arithmetic stays in an expandable review section. Cards retain two compact columns at 390px; controls wrap, while wider screens receive more breathing room.

## Implementation and integration

- `IntentHypothesis.connection` keeps observed actions, the proposed need, uncertainty and product rationale separate. Only the complementary supporting sources appear in this connection; unrelated and later commerce signals cannot masquerade as its cause.
- `POST /intent/hypotheses/:id/recommendation` requires memory on, an active confirmed need and the matching context key. It rechecks the context after search, so correction/dismissal/removal/pause cannot return a stale product. Manual `/discover` remains independent.
- `IntentStore` shares the existing SQLite connection. Durable action history preserves stable observations, deduplicates related actions, and retracts cart/group interest back to earlier readiness. Memory is opt-in. Removal works while recording is paused.
- `CommerceStore` stores saved inspiration independently of one-hour discovery sessions. Lifecycle IDs make retry safe while permitting deletion and re-save. Named collections reference those durable items without adding evidence points.
- Group campaigns have one local participant and two clearly synthetic participants. Repeated joins and campaign creation do not inflate counts. Price/currency eligibility, withdrawal, and expiry are checked server-side. Threshold crossing has no checkout side effect. Current scoring retracts on withdrawal; automatic removal of expired pledge evidence remains a follow-up beyond the short demo.
- Product recommendation saves use a local source origin, so they cannot fabricate new cross-site corroboration. Two complementary external source topics, or two separately registered controlled demo sources, are required. AI synthesis can consider bounded summaries outside the prepared topic taxonomy, including tagless saved context. The explicitly selected rule fallback still recognises only meal prep/commuting and recording/audio. Neither path treats dwell as a purchase probability.
- Automatic right-click shopping is preserved without additional popup actions. Panel wishlist and cart actions feed explicit interest; the independent attention producer submits bounded region measurements without requiring Discover to remain open. No browsing-history import or broad passive capture is implemented.
- See [the attention data contract](ATTENTION_DATA.md) for registry, metadata, thresholds, consent, deduplication and team integration details.
- AI synthesis uses `POST /intent/synthesize`; ordinary state refresh never calls the model. Results are cached by context/model/prompt/correction, and fresh generations require fresh confirmation. See [AI_SYNTHESIS.md](AI_SYNTHESIS.md).
- Attention endpoints: `/intent/attention/consent`, `/intent/attention`. Intent endpoints: `/intent`, `/intent/consent`, `/intent/observations`, `/intent/hypotheses/:id/feedback`, `/intent/observations/:id/remove`, `/intent/reset`. Commerce endpoints: `/saved-items`, `/collections`, `/group-buys`, and item/group actions.

## Team changes preserved

The implementation integrates remote commit `6f27063`: retailer-neutral search and source labels, currency improvements, selected-image fallbacks, and associated tests. It also preserves `66b7ccf` and `4e9c3c7`, which add the independent `logan/` bilingual shopper/seller workspace and HookRank content ranking.

The current integration includes main through `c9e0439`: v0.8 automatic right-click discovery, On/Off and cancellation, cart/history reset controls, automatic catalog/web selection, and PR #2’s model services. Find remains the default, Discover is optional, and the extension build includes only the shopping panel. Local recipe/commute pages remain development-only rehearsal sources. Panel wishlists and cart actions feed explicit interest without changing the three-action popup. Clearing cart retracts its readiness evidence.

Logan’s model services and optional decision adapter are now included via merged PR #2, but are not wired into the context synthesis flow.

Logan runs separately on port 4320. Its local JSON events do not yet feed the SQLite intent, collections, conditional pledges or cart. Its explicit-search adapter calls Needle's product discovery, but candidate relevance is distinct from purchase readiness. A future bridge needs stable product IDs and an explicit sharing boundary before sending browsing evidence to seller views. For this demo, present Logan as a separate seller-side concept, not an already connected merchant integration.

## Focused three-minute presentation

- 0:00–0:25: “Shopping agents usually begin with a request. What happens before someone knows what to ask for?”
- 0:25–1:00: Measure time in the recipe region. Show that one browsing habit does not trigger a recommendation.
- 1:00–1:30: Measure time in the commuting region. These are two separate everyday activities, neither a product search.
- 1:30–2:15: Show the connection and its uncertainty. This is the key moment: Needle proposes a useful need and asks the user to check it.
- 2:15–2:45: Confirm with a budget and show one relevant product with its reason. Alternatively correct to “I eat at home”, confirm the revised need, and show the changed suggestion.
- 2:45–3:00: Explain that ordinary recommenders also use behavior. The demo's distinction is permissioned cross-source context, an inspectable connection and user correction before commerce—not a claim that cursor data alone proves intent.

Before presenting, rehearse with the configured provider: the live model may abstain or choose a different supported need. Without a key, explicitly select the prepared rule demo. The development fixture at `/tests/fixtures/intent-synthesis.html` is for UI testing only and visibly labels every response as scripted.

Only extend into collections or buying if asked. Keep the first walkthrough centered on a useful connection, not conversion.
