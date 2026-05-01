# Retries, Continuations, And Blocker-Aware Execution

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony keeps work moving with bounded concurrency, retry queues, continuation turns on the same thread, and blocker-aware issue eligibility.

## Evidence
- Official announcement: [An open-source spec for Codex orchestration: Symphony](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- First-party details:
  - the announcement says agents only start when blockers are cleared and can create follow-up issues when they discover adjacent work
  - the spec requires exponential backoff for transient failures and keeps a single in-memory authority for dispatch, retries, and reconciliation
  - normal turn completion does not end the workflow; if the issue is still active, the worker should continue on the same thread up to `agent.max_turns`
  - successful work can end at a workflow-defined handoff state such as `Human Review`, not only at tracker terminal states like `Done`
  - the config surface supports both global concurrency and state-specific concurrency limits
- Latest development checkpoint:
  - the April 27, 2026 launch materials positioned dependency-aware parallelism and automatic restart behavior as central to the Symphony model

## Product signal
Symphony is treating agent execution like an always-on operational system, not a one-shot prompt, which makes retry logic and dependency handling visible product features.
