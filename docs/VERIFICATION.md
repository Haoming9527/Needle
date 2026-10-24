# Verification

Current scope: Needle 0.8.0, checked on 25 October 2026 (Asia/Singapore).

## Automated checks

Latest result: all 197 tests across 18 files pass, and the production build passes TypeScript and extension-package validation.

Run `npm test` and `npm run build` from the repository root. Tests use temporary or in-memory SQLite databases; they do not clear the user's saved data.

- Backend coverage includes catalog search, evidence integrity, original currencies, budgets, clarification history, origin restrictions, persistent cart/history, idempotent purchases, and independent collection resets. Cleared receipt payloads are removed; confirmation identifiers and hashes prevent stale retries from recreating them.
- Extension coverage includes cursor-centered crops, marked vision input, capture races, stable popup positioning, bounded glow, microphone cleanup, and ignored late responses.
- Right-click preferences cover saved Off startup, later re-enabling, native context-menu pass-through, cross-tab persistence, cancellation during capture/search/voice, and opening the side panel while Off without capturing.
- The production package contains only the extension panel, worker, content script, icons, and product images. Standalone presentation pages have been removed. The separate Logan app remains in `logan/` and is excluded from the extension build.

## Browser checks

`tests/fixtures/` exercises actual extension components with mocked Chrome/API boundaries. These pages are for development only and are excluded from the extension build.

- Clear cart and Clear history each empty only their respective fixture collection; empty controls become disabled.
- Preferences show Budget and Currency only. The source mode buttons, connection badge, and explanatory block are absent.
- The header switch persists Off after reload. Manual searches remain usable while Off and send `mode: "sample"` even when the mock backend default is live.
- With Off, the fixture site's right-click handler receives the event and no Needle search starts. Turning On in another tab restores the shopping popup.
- Clarification uses one microphone icon inside the editable answer field; typing remains available if audio fails.
- The small red marker glows during searches, stays clear of the popup, and disappears on completion or cancellation.

## External service checks

Previous authenticated checks verified OpenAI image recognition, Exa product discovery, the Decisions endpoint selecting the requested Sony WH-1000XM5 from reversed candidates, and Speech output transcribed with `gpt-transcribe`. The speech check used generated audio, not the user's microphone.

Native Chrome microphone permissions and audible playback need the user's local smoke test. Browser fixtures do not establish verification of every website or live X behavior. Product inventory, shipping, and real merchant checkout are outside this simulated-purchase extension.
