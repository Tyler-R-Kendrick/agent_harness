# Persistent Memory

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes uses bounded persistent memory as a first-class runtime primitive, with separate agent and user memory files plus pluggable external memory providers.

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official docs: [Persistent Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory/)
- Official docs: [Memory Providers](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers/)
- First-party details:
  - Hermes stores memory in `MEMORY.md` and `USER.md` under `~/.hermes/memories/`
  - those files are injected as a frozen snapshot at session start and managed by the agent through its `memory` tool
  - the docs emphasize bounded, curated memory rather than an unbounded append-only log
  - Hermes also ships external memory provider plugins for cross-session knowledge beyond the built-in files
- Latest development checkpoint:
  - the current docs continue to frame memory as a constrained but extensible system, which suggests Hermes sees stable memory quality and provider swapping as product concerns, not just prompt hacks

## Product signal
Hermes is balancing persistence with boundedness and plugin seams, which is a more operationally deliberate memory posture than a raw conversation archive.
