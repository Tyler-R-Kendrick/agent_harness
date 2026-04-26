# Context Engineering

- Harness: DeerFlow
- Sourced: 2026-04-26

## What it is
DeerFlow explicitly productizes context control through isolated sub-agent context, summarization, and tool-call recovery for long-running tasks.

## Evidence
- GitHub README: [DeerFlow - 2.0](https://github.com/bytedance/deer-flow/blob/main/README.md)
- First-party details:
  - sub-agents run in isolated context rather than sharing the lead agent transcript
  - DeerFlow summarizes completed work and offloads intermediate outputs to the filesystem
  - it includes strict tool-call recovery to keep OpenAI-compatible reasoning models from failing on malformed tool history

## Product signal
This is a strong example of harnesses competing on runtime context management, not only prompt quality.
