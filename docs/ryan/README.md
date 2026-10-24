# Ryan — Part 4: Context to intent

Needle helps someone move from scattered browsing context to a tentative need they can inspect, correct, and confirm. Ryan’s Part 4 adds this low-intent flow alongside the team’s existing cursor capture and product search.

**Pitch:** “Before someone knows what to search for, useful context is scattered across what they read. Needle connects opted-in observations into a possible need, shows its evidence and uncertainty, and asks the person before finding a product.”

Cursor attention is an additional context signal, not proof of desire or a purchase probability. The difference being demonstrated is an inspectable connection between source meanings, followed by user confirmation. This is not a claim that other recommendation systems never use dwell time.

| Read next | Purpose |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Components, request boundaries, and cancellation |
| [Data and evidence](DATA.md) | What is measured, stored, and sent to AI |
| [Setup and demo](DEMO.md) | Safe setup, three-minute slice, seven-minute team sequence |
| [Integration contract](INTEGRATION.md) | Ownership boundaries and pre-merge checklist |
| [Review backlog](REVIEW.md) | Remaining checks and separate seller/model work |
| [Wiki source](wiki/Home.md) | Pages prepared for the repository’s GitHub Wiki |

## Status — 25 October 2026

This is a pre-merge package for `codex/connected-intent-demo` in [PR #1](https://github.com/Haoming9527/Needle/pull/1). The local integration worktree uses `codex/ryan-part4-package`; it is not a separate review PR. Branch presence, a local build, or a mock-provider test does not mean it has merged, deployed, or completed a live AI rehearsal. Check the pull request and [verification ledger](../VERIFICATION.md) for the latest evidence. Live synthesis and installed-Chrome rehearsal remain release checks.

The current browsing demonstration measures two prepared source identities on the **same local origin**. It demonstrates a cross-source flow; arbitrary cross-site attention collection is not implemented. The AI path can assess bounded observations beyond the prepared recipe/commute topics. A separately labelled prepared rule-based demo remains available without a key.

Logan’s decision/model changes are a separate [PR #2](https://github.com/Haoming9527/Needle/pull/2), not an integrated bridge to Part 4. Other team members retain ownership of their existing capture, search, voice, and seller work.

The [GitHub Wiki](https://github.com/Haoming9527/Needle/wiki) provides the team-facing guide. Its versioned source is in `wiki/`; publish those files as top-level wiki pages when updating it. Root-level documentation remains the team’s shared reference.
