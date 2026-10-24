# Setup and demo

[Part 4 home](README.md) · [Readiness backlog](REVIEW.md)

## Local setup

Use Node 22.13 or later and the repository’s lockfile. From the repository root:

```sh
npm ci
[ -f .env ] || cp .env.example .env
npm run dev
```

Privately set `OPENAI_API_KEY` in the local `.env` for the direct-provider AI path. Never paste the value into documentation, chat, terminal output, screenshots, or commits. Keep the configured model unless the team deliberately changes it. Use a separate `DATABASE_PATH`, such as `.local/ryan-part4-demo.sqlite`, for rehearsal. Search provider configuration and optional `EXA_API_KEY` are separate; live web results are not required to demonstrate a labelled catalog offer. Consult the shared [README](../../README.md) for the full environment setup.

Open `http://127.0.0.1:5173/panel.html`, then select **Discover**. Find remains the default. The recipe and commute pages are development-only rehearsal sources; the extension build contains only `panel.html`. Once opted in on a supported page, measurement runs without keeping Discover open. Before presenting, verify the server is running, model availability is shown correctly, and both reading pages open. Without a valid key, use **Show prepared rule-based demo** and say so explicitly. A scripted fixture or prepared rule result is not live AI.

## Three-minute Part 4 slice

| Time | Action | Narration |
| --- | --- | --- |
| 0:00–0:25 | Show the context view; enable local memory and attention on the reading pages | “Someone may not know what to search for yet. We start with context they opt in to share.” |
| 0:25–0:55 | Read the marked recipe region, then commute region; dwell at least 2 seconds in each | “These are two prepared sources. The cursor timing is measured; the source summaries are demo context.” |
| 0:55–1:20 | Return and review the recorded summaries and durations | “Attention is a weak signal. These observations are visible and removable.” |
| 1:20–1:50 | Explicitly request AI connection; show citations and uncertainty | “The agent proposes a possible need—or abstains. It has not searched for a product yet.” |
| 1:50–2:25 | Confirm the current need with a budget/constraint; show the inline offer | “Only after confirmation do we search using that need. This is a suggestion, not a purchase.” |
| 2:25–3:00 | Correct the need, or remove evidence/pause memory | “The old result is withdrawn. A changed interpretation needs confirmation again.” |

Allow for provider latency. Do not promise a particular hypothesis: an honest abstention is valid. If live AI fails, explain the failure and deliberately switch to the labelled prepared demo; do not disguise the switch.

## Seven-minute whole-team sequence

Use this as a proposed handoff order, not a claim of ownership over teammates’ features.

1. **0:00–0:45 — Problem and thesis:** context is fragmented before a search exists.
2. **0:45–1:45 — Existing cursor workflow:** the owning teammate shows automatic right-click search and clarification; cart provides a stronger, explicit-interest signal.
3. **1:45–4:45 — Ryan’s Part 4:** run the three-minute sequence above.
4. **4:45–5:45 — Existing result experience:** the owning teammate shows comparison or voice where rehearsed. No payment claim.
5. **5:45–6:30 — Seller-side direction:** describe Logan’s separate work and proposed bridge; show it separately only if prepared. Do not imply shared live data.
6. **6:30–7:00 — Close:** inspectable evidence, human correction, and confirmation before discovery; state controlled-demo limits and next integration step.

## Rehearsal checks

- Run `npm test`, `npm run typecheck`, and `npm run build` after resolving the integration branch. Record the actual results in the shared verification ledger.
- Perform one real configured-provider synthesis, one correction, one abstention/error, and confirmation-to-result flow. Record provenance without credentials.
- Load the built extension in Chrome; verify existing automatic right-click search, crop clarification, and latest voice behavior remain intact. Browser fixture tests do not substitute for this check.
- Confirm pause/remove/reset during a delayed request cannot restore a stale suggestion. Reset the rehearsal database/context before the stage run.
