# Retries, Continuations, And Blocker-Aware Execution

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony keeps work moving with bounded concurrency, retry queues, continuation turns on the same thread, and blocker-aware issue eligibility, while now distinguishing true retryable failures from runs that are paused waiting for operator input.

## Evidence
- Official announcement: [An open-source spec for Codex orchestration: Symphony](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- Open PR: [#66 Surface input-blocked Symphony sessions](https://github.com/openai/symphony/pull/66)
- First-party details:
  - the announcement says agents only start when blockers are cleared and can create follow-up issues when they discover adjacent work
  - the spec requires exponential backoff for transient failures and keeps a single in-memory authority for dispatch, retries, and reconciliation
  - normal turn completion does not end the workflow; if the issue is still active, the worker should continue on the same thread up to `agent.max_turns`
  - successful work can end at a workflow-defined handoff state such as `Human Review`, not only at tracker terminal states like `Done`
  - the config surface supports both global concurrency and state-specific concurrency limits
  - PR #66 says Codex `input-required` events and MCP elicitation events should pause visibly as blocked sessions instead of consuming retry attempts
  - the same PR keeps blocked issues claimed until Linear routing or state changes, and exposes blocked counts plus per-issue blocked details in the state snapshots and dashboard presenters
- Latest development checkpoint:
  - on May 5, 2026, OpenAI proposed an explicit input-blocked state, which sharpens Symphony from generic background retries into a harness that understands human-in-the-loop pauses as a first-class runtime condition

## Product signal
Symphony is treating agent execution like an always-on operational system, not a one-shot prompt, and the blocked-session work shows the orchestrator is moving toward explicit intervention queues instead of hiding stalled runs behind generic failure loops.
