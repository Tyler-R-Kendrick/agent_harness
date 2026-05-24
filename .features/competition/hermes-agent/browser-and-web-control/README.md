# Browser And Web Control

- Harness: Hermes Agent
- Sourced: 2026-05-24

## What it is
Hermes ships browser and computer-use control as part of the main harness, with local browser automation, attached sessions, managed tool-gateway paths, background macOS desktop control, and adjacent web-search surfaces such as `x_search`.

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official docs: [Computer Use](https://hermes-agent.nousresearch.com/docs/user-guide/features/computer-use)
- Official docs: [Tools & Toolsets](https://hermes-agent.nousresearch.com/docs/user-guide/features/tools/)
- Official docs: [Features Overview](https://hermes-agent.nousresearch.com/docs/user-guide/features/overview/)
- Official release: [Hermes Agent v0.14.0](https://github.com/NousResearch/hermes-agent/releases)
- First-party details:
  - the product surface still bundles web search, extraction, screenshots, and browser automation into the main harness
  - Hermes now documents background macOS computer use through `cua-driver`, explicitly comparing it to Codex-style background computer use while keeping the surface model-agnostic
  - the tool catalog includes paid Tool Gateway browser automation plus opt-in `x_search` for X or Twitter threads
  - the latest docs still position browser and desktop control as toolsets the agent can enable through the main runtime rather than as a separate product
- Latest development checkpoint:
  - the May 2026 docs show Hermes broadening from browser-only automation into a wider web-plus-desktop action layer with both local and managed execution paths

## Product signal
Hermes treats browser and desktop action as a default harness capability with both local and managed execution paths, which lowers the barrier between coding, ops, and web-task automation.
