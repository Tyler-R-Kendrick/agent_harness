# Context Condensing And Queued Steering

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo manages long-running sessions with automatic context condensing and lets users queue follow-up messages while the agent is still working.

## Evidence
- Official docs: [Intelligent Context Condensing](https://docs.roocode.com/features/intelligent-context-condensing)
- Official docs: [Message Queueing](https://docs.roocode.com/features/message-queueing)
- First-party details:
  - Roo summarizes older conversation segments when the context window approaches its limit
  - the condensing flow tries to preserve essential information and keep the session coherent over long runs
  - slash commands from the first message are preserved across condensations
  - users can queue messages while Roo is still processing and Roo handles them in order
  - queued messages implicitly approve the next pending action, even when normal auto-approval is disabled
- Latest development checkpoint:
  - the current docs keep the implicit-approval behavior explicit and separate from the main auto-approve setting, which shows Roo treating uninterrupted steering as a deliberate workflow primitive rather than as an accidental side effect

## Product signal
Roo is optimizing for long, live, interruptible sessions where the user keeps steering without forcing the agent back to an idle state first.
