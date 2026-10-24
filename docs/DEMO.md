# Needle presentation guide

**Primary pitch:** “Most shopping assistants start when you already know what to search for. Needle connects permissioned context across everyday browsing, asks whether the inferred need makes sense, then helps you discover and save a relevant product. Recipe browsing and cycling tips can become a useful question about carrying lunch—before a shopping query exists.”

Use [the connected-intent walkthrough](CONNECTED_DEMO.md) for the main hackathon story. The flow below remains the explicit-shopping branch. Cursor behavior is a source of contextual evidence, not proof of intent; existing recommenders also use behavioral signals. Our demo differentiator is the visible cross-site connection, confirmation/correction, and separate purchase-readiness state.

This presentation uses a shopping prototype with source-backed products, prepared prices where needed, and simulated purchases. Explain that once at the start; the interface then follows a normal shopping flow.

## Start

1. Keep the configured .env, run `npm run dev`, then `npm run build`.
2. Reload the unpacked extension from `dist/extension` in Chrome.
3. Check extension version 0.7.0 and refresh the target webpage after upgrading.
4. Open [The Everyday Edit article](http://127.0.0.1:5173/demo.html). The [studio video fixture](http://127.0.0.1:5173/x-demo.html) is a second scenario.
5. For AI image recognition, OPENAI_API_KEY (or AI_GATEWAY_API_KEY) must be configured. Add EXA_API_KEY for automatic web search when the prepared catalog has no match.

## Seven-minute story

| Time | Show |
| --- | --- |
| 0:00–0:40 | Explain the problem: inspiration is disconnected from purchase. State that this uses a local catalog and web product references with simulated purchases. |
| 0:40–1:40 | Read the article, then right-click its headphone photo. Choose **Find products**; the popup animates while Needle searches. |
| 1:40–2:30 | Show the recommendation and price. Choose Buy to review and confirm the simulated purchase, or Add to cart to save it. |
| 2:30–3:20 | Open Needle, inspect Cart, change quantity, and demonstrate persistence by refreshing. |
| 3:20–4:10 | Buy the cart item, confirm it, and open History. |
| 4:10–5:00 | Find headphones and refine: “Similar, under KRW 50,000.” The target remains in context. |
| 5:00–6:00 | Search “Black F-style electric mandolin.” Show Exa's web product references, retained prices, and original source in Product details. Later searches reuse the SQLite records. |
| 6:00–7:00 | Explain the production path: retailer catalog access, verified prices/stock, and buyer checkout integration. |

## Recovery

- **No key:** Describe an item in the panel; the local catalog can still search text. Do not claim that this path ran image recognition.
- **Wrong object:** Right-click directly on it. Needle labels that exact cursor point for the agent. If a question appears, answer in the popup and press Enter or Search; it reuses the same frame. The panel also supports replies and manual crop/description controls.
- **No catalog match:** With both keys, Needle automatically searches the wider web. References become local demo items with source links; they do not establish current inventory. The full request times out after 45 seconds with retry available.
- **Normal Chrome menu instead of the toolbar:** Reload Needle, verify version 0.7.0, and refresh the tab. Ensure Needle's site access is enabled. Ordinary images, video overlays, backgrounds, and page areas use the custom toolbar; editable fields and Shift + right-click preserve the normal menu.
- **Black video capture:** Protected video may not expose pixels. Use a description.
- **Service offline:** Start `npm run dev`; check `http://127.0.0.1:4318/health`.
- **AI request fails:** Check the key/model in .env, restart the API, and retry. Keys must never be shown on screen.
- **Web search mode:** Separate from the automatic catalog fallback. Requires EXA_API_KEY and retrieved product evidence; unknown prices remain unknown. Run the coverage check before presenting direct web retrieval.

The local X-style page is an interaction fixture, not the actual X site. Demonstrate the real site separately when claiming actual X verification.

