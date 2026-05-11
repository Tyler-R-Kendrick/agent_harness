# Autonomous Agent Core

- Harness: Kimi AI
- Sourced: 2026-05-11

## What it is
Kimi's base agent mode is a general-purpose autonomous worker that plans tasks, invokes tools, self-corrects, and returns concrete deliverables instead of only chat responses.

## Evidence
- Official docs: [K2.6 Agent overview](https://www.kimi.com/help/agent/agent-overview)
- First-party details:
  - Kimi says the K2.6 Agent handles complex tasks end-to-end
  - it uses 20+ tools to build websites, generate documents, analyze data, and more
  - the runtime explicitly decomposes requests into sub-tasks, invokes tools, executes autonomously, and self-corrects when errors happen
  - deliverables are framed as Office files, web apps, or reports rather than only in-chat prose
- Latest development checkpoint:
  - the current K2.6 overview positions the agent as the umbrella surface that routes into Websites, Docs, Sheets, Slides, Deep Research, Swarm, and Kimi Claw rather than as a narrow standalone chat mode

## Product signal
Kimi treats the general agent as an execution router across multiple deliverable-native products, which makes the harness feel closer to an operating surface than to a single assistant persona.
