# Connected intent demo

This demo starts with everyday activity, before a shopping request. The cross-site replay is explicitly synthetic. It does not claim passive cursor telemetry has been implemented.

1. Open the Intent workspace and enable local context memory. Explain that saving context is optional and can be paused or reset.
2. Replay the recipe source. The labelled fixture adds meal-prep attention and revisit observations. At this point, Needle should not infer lunch on the move.
3. Replay cycling-to-work. The second source adds complementary commuting context. Show both source origins in the evidence list.
4. Needle tentatively asks whether carrying lunch to work would be useful. Interest confidence and purchase readiness are separate; weak browsing evidence does not imply a ready buyer.
5. Expand “How the score works” to show heuristic arithmetic and evidence provenance. Scores are not purchase probabilities.
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
