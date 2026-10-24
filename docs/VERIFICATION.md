# Verification

Current scope: Needle 0.8.2, checked on 25 October 2026 (Asia/Singapore).

## Automated checks

Latest result: all 244 tests across 21 files pass, and the production build passes TypeScript and extension-package validation.

Run `npm test` and `npm run build` from the repository root. Tests use temporary or in-memory SQLite databases; they do not clear the user's saved data.

- Backend coverage includes catalog search, evidence integrity, original currencies, budgets, clarification history, origin restrictions, persistent cart/history, idempotent purchases, and independent collection resets. Cleared receipt payloads are removed; confirmation identifiers and hashes prevent stale retries from recreating them.
- Catalog recall regression reproduced a saved MacBook disappearing before Decisions compared candidates. Search now considers a bounded pool of eight, scores category membership independently of title wording, uses structured brand/model evidence, and preserves omitted candidates for the visual decision. The final response still contains at most three offers; category and exact-currency budget filters remain in force.
- Extension coverage includes cursor-centered crops, marked vision input, capture races, stable popup positioning, bounded glow, microphone cleanup, and ignored late responses.
- Right-click preferences cover saved Off startup, later re-enabling, native context-menu pass-through, cross-tab persistence, cancellation during capture/search/voice, and opening the side panel while Off without capturing.
- The production package contains only the extension panel, worker, content script, icons, and product images. Standalone presentation pages have been removed. The separate Logan app remains in `logan/` and is excluded from the extension build.
- Recovery coverage includes one broader search, answerable empty results, retained refinement requirements, budget-aware questions, and catalog evidence preserved after a later AI summary failure. Abort signals remain authoritative.
- Lost discovery replies retry once using the same capture or in-flight request. Replacement content scripts dispose stale listeners and popups; cancellation and Off prevent late retries.
- Version 0.8.2 fixes a silent message rejection after same-origin SPA navigation. The reproduced regression supplied different sender/tab paths and observed no reply. Messages now authenticate extension, top frame, and HTTP(S) origin; capture still verifies tab identity, URL, and geometry. Invalid messages from the authorized content script receive an explicit error.
- Cart retries use persistent operation identifiers, preserving quantities across lost responses and server restarts. Replays cannot resurrect cleared items or accept changed payloads. Malformed cart replies cannot report success.
- Panel transport rejects incomplete JSON and late responses after cancellation; timeout errors are readable. The visible panel checks for service recovery without overlapping health requests.

## Browser checks

`tests/fixtures/` exercises actual extension components with mocked Chrome/API boundaries. These pages are for development only and are excluded from the extension build.

- Clear cart and Clear history each empty only their respective fixture collection; empty controls become disabled.
- Preferences show Budget and Currency only. The source mode buttons, connection badge, and explanatory block are absent.
- The header switch persists Off after reload. Manual searches remain usable while Off and send `mode: "sample"` even when the mock backend default is live.
- With Off, the fixture site's right-click handler receives the event and no Needle search starts. Turning On in another tab restores the shopping popup.
- Clarification uses one microphone icon inside the editable answer field; typing remains available if audio fails.
- The small red marker glows during searches, stays clear of the popup, and disappears on completion or cancellation.
- Version 0.8.1: `toolbar.html?empty=1` returned an answerable question; submitting a typed answer produced a recommendation and enabled Buy/Add to cart without another capture.
- Version 0.8.1: `toolbar.html?disconnect=1` deliberately dropped a reply and automatically recovered the same recommendation without refreshing the page or capturing again.
- The combined panel reconnect/cart retry fixture is prepared but not interactively verified. Native Chrome reload verification was stopped when the user pressed Escape. A later 0.8.2 attempt was stopped by browser automation because it could not verify the current address. The installed extension still needs reloading to 0.8.2; the native route test is available at `tests/fixtures/native-spa.html`.

## External service checks

Previous authenticated checks verified OpenAI image recognition, Exa product discovery, the Decisions endpoint selecting the requested Sony WH-1000XM5 from reversed candidates, and Speech output transcribed with `gpt-transcribe`. The speech check used generated audio, not the user's microphone.

Version 0.8.1 authenticated Decisions smoke test: the previously rejected description “Dark laptop with SpaceX lettering on the lid” returned three prepared laptop choices, with ASUS Vivobook 15 selected as a similar alternative. This test used the description and prepared candidates, not the original video frame.

Catalog recall fix: an authenticated image-recognition/catalog/Decisions check used the user's supplied laptop screenshot and a cursor point on the laptop. Recognition returned Apple with model unknown. Both saved MacBooks reached comparison; Decisions selected the cached MacBook Pro, with the MacBook Air also available. The result remains a similar match, not an exact-model claim. The catalog was read in read-only mode; this check did not create a session, cart item, or order. This verifies the backend path, not a new native Chrome capture.

Native Chrome microphone permissions and audible playback need the user's local smoke test. Browser fixtures do not establish verification of every website or live X behavior. Product inventory, shipping, and real merchant checkout are outside this simulated-purchase extension.
