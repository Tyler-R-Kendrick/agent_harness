# Context Condensing And Auto-Compaction

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo actively manages long conversations by compacting old context into anchored summaries and pruning stale tool output before context windows become unusable.

## Evidence
- Official docs: [Context Condensing](https://kilo.ai/docs/customize/context/context-condensing)
- Official releases: [Kilo releases](https://github.com/Kilo-Org/kilocode/releases)
- First-party details:
  - Kilo says compaction produces a summary that preserves session goal, constraints, progress, key decisions, next steps, and relevant files
  - older completed tool outputs outside a recency window can be replaced with a cleared placeholder to save tokens before full compaction is needed
  - users can trigger compaction manually with `/compact`
  - Kilo can use a separate compaction agent and model for summarization
  - the May 6, 2026 pre-release notes mention queued-turn auto-compaction overflow recovery fixes
- Latest development checkpoint:
  - the recent fix work around queued-turn compaction shows Kilo treating context management as an operational reliability problem, not only a convenience feature

## Product signal
Kilo is building explicit transcript lifecycle management so long-running agent sessions stay resumable without blindly carrying the whole raw trace forever.