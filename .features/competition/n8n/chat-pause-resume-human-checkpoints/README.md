# Chat Pause Resume Human Checkpoints

- Harness: n8n
- Sourced: 2026-05-10

## What it is
n8n's Chat node now supports live human checkpoints inside an agentic execution, including pause-and-wait steps that resume when the user replies.

## Evidence
- Official docs: [Chat node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-langchain.chat/)
- Official docs: [Release notes](https://docs.n8n.io/release-notes/)
- First-party details:
  - n8n added `Send a message` and `Send a message and wait for response` actions for agentic workflows
  - these actions can be used as deterministic workflow steps or exposed to an AI Agent as tools
  - the wait action pauses execution until the user replies with free text or inline approval buttons
  - n8n recommends this pattern when the agent may need clarification before proceeding
- Latest development checkpoint:
  - the release notes for `n8n@1.101.0`, dated January 20, 2026, introduced these human-in-the-loop chat actions

## Product signal
n8n is making human escalation a first-class execution state, not just an out-of-band comment or failed run.
