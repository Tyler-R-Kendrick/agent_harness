# Per-Issue Token Usage Ledger And API Accounting

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony is adding durable per-issue token accounting so operators can retain usage visibility after runs complete or the orchestrator restarts.

## Evidence
- Open PR: [#60 Persist per-issue token usage](https://github.com/openai/symphony/pull/60)
- First-party details:
  - PR #60 says live token totals were visible during active runs, but completed tickets lost per-issue observability after exit or restart
  - the proposed fix persists per-issue Codex token totals in a JSONL ledger next to the existing Symphony logs
  - the ledger records both live and final high-water token observations per issue and session
  - observability API responses gain ledger-backed summaries
  - the PR explicitly rejects pushing this data into Linear comments, framing tracker comments as a display surface rather than a durable accounting system
- Latest development checkpoint:
  - on April 21, 2026, OpenAI proposed durable token ledgers as an observability primitive instead of limiting cost visibility to the active process lifetime

## Product signal
Symphony reinforces a trend toward agent-harness cost accounting that is durable, queryable, and attached to the runtime itself rather than scattered across UI chrome or ephemeral transcripts.
