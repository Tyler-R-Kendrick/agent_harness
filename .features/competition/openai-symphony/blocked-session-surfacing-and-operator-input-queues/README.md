# Blocked Session Surfacing And Operator Input Queues

- Harness: OpenAI Symphony
- Sourced: 2026-05-17

## What it is
Symphony is adding first-class visibility for sessions blocked on human or MCP input so they pause as operator-actionable work instead of being misclassified as transient failures.

## Evidence
- Open PR: [#66 Surface input-blocked Symphony sessions](https://github.com/openai/symphony/pull/66)
- First-party details:
  - PR #66 says Codex app-server sessions can request operator input or MCP elicitation and these cases should pause visibly instead of retrying until exhausted
  - the proposed behavior treats Codex `input-required` and MCP elicitation events as blocked sessions
  - blocked issues stay claimed until Linear routing or issue state changes make them ineligible
  - the state model and presenter payloads gain blocked counts and per-issue blocked details
  - the dashboard renders blocked sessions directly and the PR adds regression coverage for app-server and orchestrator blocked flows
- Latest development checkpoint:
  - on May 5, 2026, OpenAI proposed making blocked human-input states part of the orchestration model rather than leaving them implicit in logs or retry counters

## Product signal
Symphony is showing that autonomous harnesses need a visible intervention queue, where the important product event is not just failure or success but “the system is waiting for a human to unblock the next move.”
