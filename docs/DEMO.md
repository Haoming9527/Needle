# Needle presentation guide

**Pitch:** “See an item anywhere. Right-click it. Needle finds it across stores, ready to buy or save.”

This presentation uses a shopping prototype with source-backed products, prepared prices where needed, and simulated purchases. Explain that once at the start; the interface then follows a normal shopping flow.

## Start

1. Keep the configured .env, run `npm run dev`, then `npm run build`.
2. Reload the unpacked extension from `dist/extension` in Chrome.
3. Check extension version 0.4.0 and refresh the target webpage after upgrading.
4. Open [the local video fixture](http://127.0.0.1:5173/x-demo.html) or an X post with visible retail objects.
5. For AI image recognition, OPENAI_API_KEY (or AI_GATEWAY_API_KEY) must be configured. Add EXA_API_KEY for automatic web search when the prepared catalog has no match.

## Seven-minute story

| Time | Show |
| --- | --- |
| 0:00–0:40 | Explain the problem: inspiration is disconnected from purchase. State that this uses a local catalog and web product references with simulated purchases. |
| 0:40–1:40 | Right-click the microphone in the video. The three-control popup appears while Needle identifies the crop. |
| 1:40–2:30 | Show the recommendation, price, and variant. Add it to the cart directly from the popup. |
| 2:30–3:20 | Open Needle, inspect Cart, change quantity, and demonstrate persistence by refreshing. |
| 3:20–4:10 | Buy the cart item, confirm it, and open History. |
| 4:10–5:00 | Find headphones and refine: “Similar, under KRW 50,000.” The target remains in context. |
| 5:00–6:00 | Search “Black F-style electric mandolin.” Show Exa's web product references, retained prices, and original source in Product details. Later searches reuse the SQLite records. |
| 6:00–7:00 | Explain the production path: retailer catalog access, verified prices/stock, and buyer checkout integration. |

## Recovery

- **No key:** Describe an item in the panel; the local catalog can still search text. Do not claim that this path ran image recognition.
- **Wrong object:** Right-click closer to it, or use the panel's crop/description controls.
- **No catalog match:** With both keys, Needle automatically searches the wider web. References become local demo items with source links; they do not establish current inventory. The full request times out after 45 seconds with retry available.
- **Normal Chrome menu instead of the toolbar:** Reload Needle, verify version 0.4.0, and refresh the tab. Ensure Needle's site access is enabled. Ordinary images, video overlays, backgrounds, and page areas use the custom toolbar; editable fields and Shift + right-click preserve the normal menu.
- **Black video capture:** Protected video may not expose pixels. Use a description.
- **Service offline:** Start `npm run dev`; check `http://127.0.0.1:4318/health`.
- **AI request fails:** Check the key/model in .env, restart the API, and retry. Keys must never be shown on screen.
- **Web search mode:** Separate from the automatic catalog fallback. Requires EXA_API_KEY and retrieved product evidence; unknown prices remain unknown. Run the coverage check before presenting direct web retrieval.

The local X-style page is an interaction fixture, not the actual X site. Demonstrate the real site separately when claiming actual X verification.

