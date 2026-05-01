# Session Tree Branching And Compaction

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi stores sessions as JSONL trees, supports in-place branch navigation, and uses both manual and automatic compaction to keep long-running sessions usable without discarding underlying history.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- Official compaction docs: [docs/compaction.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/compaction.md)
- First-party details:
  - the README says session entries keep `id` and `parentId`, enabling branching within a single JSONL session file
  - `/tree`, `/fork`, and `/clone` are first-class session-navigation commands
  - compaction is both automatic and manual, with configurable reserve behavior and extension hooks for customization
  - the full history stays in the session file even when the active prompt context has been compacted
- Latest development checkpoint:
  - Pi's documentation frames compaction and branch summarization as core operating primitives rather than emergency fallbacks for overlong chats

## Product signal
Pi is stronger than many harnesses at treating long sessions as navigable state, not just a flat transcript, which matters for debugging, alternate approaches, and durable agent runs.
