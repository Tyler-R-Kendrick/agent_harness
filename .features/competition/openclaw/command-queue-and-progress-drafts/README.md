# Command Queue And Progress Drafts

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw gives users explicit control over what happens when they interrupt or steer a run in progress, and it pairs that with a single visible progress draft instead of chat spam.

## Evidence
- Official docs: [Command Queue](https://docs.openclaw.ai/concepts/queue)
- Official docs: [Progress drafts](https://docs.openclaw.ai/concepts/progress-drafts)
- First-party details:
  - queue modes include `steer`, `followup`, `collect`, `steer-backlog`, and legacy `interrupt`
  - `steer` injects immediately into the current run at the next tool boundary, while `followup` waits for the current run to finish
  - `collect` coalesces queued messages into a single follow-up turn, and `steer-backlog` both steers now and preserves the message for a later follow-up
  - per-session overrides can be set from chat with `/queue <mode>` plus debounce, cap, and overflow policies
  - progress drafts create one visible work-in-progress message only after the turn proves it is doing real work, then update that draft while the agent reads, plans, calls tools, or waits for approval
- Latest development checkpoint:
  - the current docs frame queue control and progress drafts as standard runtime behavior across chat-heavy, tool-heavy sessions rather than niche debugging features

## Product signal
OpenClaw is hardening the contract between human steering and agent execution. The product direction is toward explicit intervention semantics instead of “just send another message and hope the runtime does something reasonable.”
