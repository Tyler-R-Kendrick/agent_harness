# Agent Mode Conversations And Context

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp now separates the terminal and the agent conversation into distinct but tightly connected modes, so multi-turn work keeps its own controls and context instead of being squeezed into a plain command line.

## Evidence
- Official docs: [Universal Input](https://docs.warp.dev/terminal)
- Official docs: [Agent modality](https://docs.warp.dev/agent-platform/local-agents/interacting-with-agents/agent-modality)
- Official docs: [Local agents overview](https://docs.warp.dev/agent-platform/agent/agents-overview)
- First-party details:
  - Warp's Universal Input can detect natural-language requests and switch into Agent Mode without leaving the terminal surface
  - agent modality gives users a dedicated conversation view for multi-turn work, with explicit mode switching instead of a permanently cluttered prompt bar
  - users can attach files, URLs, images, selections, and terminal blocks as structured context for the conversation
  - the conversation view preserves richer controls such as model selection, history, and follow-up turns while staying linked to the same shell workspace
- Latest development checkpoint:
  - Warp's current docs describe agent modality and Universal Input as the default interaction model, which signals that conversational agent work is now a primary product surface rather than a sidecar command generator

## Product signal
Warp is converging terminal execution and structured conversation into one input stack, which matters because developers increasingly want persistent agent context without giving up a clean shell.
