# Subagents And Remote A2A Delegation

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI now supports both local subagents and remote agent-to-agent delegation, so the harness can split work across specialized workers and reach external agents over a defined protocol boundary.

## Evidence
- Official docs: [Subagents](https://geminicli.com/docs/core/subagents/)
- Official docs: [Remote Agents](https://geminicli.com/docs/core/remote-agents/)
- First-party details:
  - Gemini CLI documents dedicated subagents for decomposition and specialization inside a run.
  - Remote Agents extends that model across A2A boundaries instead of limiting delegation to the local process.
  - The docs position remote delegation as a first-class architecture pattern rather than an ad hoc shell escape hatch.
- Latest development checkpoint:
  - both local and remote agent delegation are present in the current core docs, showing that orchestration has become part of the product story.

## Product signal
Gemini CLI is moving from a single assistant toward a delegated agent system. Remote A2A support also suggests growing pressure for inter-harness coordination rather than closed runtimes.
