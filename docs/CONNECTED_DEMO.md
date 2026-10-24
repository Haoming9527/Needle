# Connected intent demo

This demo starts with everyday activity, before a shopping request. The cross-site replay is explicitly synthetic. It does not claim passive cursor telemetry has been implemented.

1. Open **Discover** and enable local context memory. Explain that saving context is optional and can be paused or reset.
2. Replay the recipe source. The labelled fixture adds meal-prep attention and revisit observations. At this point, Needle should not infer lunch on the move.
3. Replay cycling-to-work. The second source adds complementary commuting context. Show both source origins in the evidence list.
4. Needle tentatively asks whether carrying lunch to work would be useful. Interest confidence and purchase readiness are separate; weak browsing evidence does not imply a ready buyer.
5. Expand “Review evidence & scoring” to show heuristic arithmetic and evidence provenance. Scores are not purchase probabilities.
6. Confirm the need with an optional constraint, then discover a portable lunch container. Product search only starts after confirmation.
7. Alternatively select “I eat at home.” Needle changes the need to food storage at home and searches food storage containers. This is a different product objective, not merely reworded copy.
8. Continue into the separate collection/wishlist and group-buy workspace. Seeded group participants, illustrative prices and simulated checkout must remain clearly labelled.
9. Remove an evidence item, dismiss a suggestion, or reset memory to demonstrate control. Replaying a source twice must not duplicate its events.

## Boundaries

- Recipe/cycling replay events are `demo_fixture`; actual right-click actions must be `observed`.
- The current extension captures explicit selections. Hover/dwell/revisit replay is a demonstration input, not proof of deployed passive capture.
- Browser-page text and inferred needs are uncertain evidence. The user can confirm or correct a hypothesis.
- Context stays in the local prototype; no retailer data-sharing integration is represented.
- Group-buy interest is conditional and does not place an order or join an external buying group.

## Visual references

These patterns were reviewed via Mobbin and adapted to Needle's context flow, not copied as complete screens:

- [ZARA wishlist](https://mobbin.com/screens/51153b34-429f-4b9f-97cc-bb261245612c): clear named content and an airy card layout, avoiding a dense control dashboard.
- [AirOps recommended prompts](https://mobbin.com/screens/ae0f151a-f195-43ba-9f2f-9c3ff74bfa10): one prominent question, supporting source chips and nearby accept/dismiss controls.
- [Variant evidence layout](https://mobbin.com/screens/42d49819-409e-47cd-9614-f0266711069a): two adjacent evidence cards make the connection between otherwise separate moments visible.

The key demo reveal now reads visually as two source cards → one tentative question → user confirmation or correction. Detailed arithmetic stays in an expandable review section. Cards retain two compact columns at 390px; controls wrap, while wider screens receive more breathing room.

## Implementation and integration

- `IntentStore` shares the existing SQLite connection. Durable action history preserves stable observations, deduplicates related actions, and retracts cart/group interest back to earlier readiness. Memory is opt-in. Removal works while recording is paused.
- `CommerceStore` stores saved inspiration independently of one-hour discovery sessions. Lifecycle IDs make retry safe while permitting deletion and re-save. Named collections reference those durable items without adding evidence points.
- Group campaigns have one local participant and two clearly synthetic participants. Repeated joins and campaign creation do not inflate counts. Price/currency eligibility, withdrawal, and expiry are checked server-side. Threshold crossing has no checkout side effect.
- Product recommendation saves use a local source origin, so they cannot fabricate new cross-site corroboration. Two complementary external source topics are required. These demo rules recognise meal prep/commuting and recording/audio, not arbitrary human needs. Tags are a bounded rule taxonomy; the existing AI still handles product vision and search.
- Cursor Save extracts bounded selected text/labels and a nearby heading, without a screenshot or product search. There is no passive history collection.
- Intent endpoints: `/intent`, `/intent/consent`, `/intent/observations`, `/intent/hypotheses/:id/feedback`, `/intent/observations/:id/remove`, `/intent/reset`. Commerce endpoints: `/saved-items`, `/collections`, `/group-buys`, and item/group actions.

## Team changes preserved

The implementation integrates remote commit `6f27063`: retailer-neutral search and source labels, currency improvements, selected-image fallbacks, and associated tests. It also preserves `66b7ccf` and `4e9c3c7`, which add the independent `logan/` bilingual shopper/seller workspace and HookRank content ranking.

Logan runs separately on port 4320. Its local JSON events do not yet feed the SQLite intent, collections, conditional pledges or cart. Its explicit-search adapter calls Needle's product discovery, but candidate relevance is distinct from purchase readiness. A future bridge needs stable product IDs and an explicit sharing boundary before sending browsing evidence to seller views. For this demo, present Logan as a separate seller-side concept, not an already connected merchant integration.

## Seven-minute presentation

- 0:00–0:40: Most commerce starts with a query. Needle explores the moment before that.
- 0:40–1:30: Opt in and replay recipe browsing. One clue does not produce a recommendation.
- 1:30–2:45: Replay commuting. Show the two sources and tentative question; buying readiness remains Exploring.
- 2:45–3:30: Confirm with a budget, or demonstrate “I eat at home” changing the product objective.
- 3:30–4:30: Discover a suitable item, wishlist it, and organise it into a collection.
- 4:30–5:30: Express conditional group interest; show you plus two simulated peers, then withdraw.
- 5:30–6:20: Independently choose cart and a clearly simulated checkout.
- 6:20–7:00: Explain the bounded heuristic, user control, and the path toward consented real-world signals and real merchant integrations.
