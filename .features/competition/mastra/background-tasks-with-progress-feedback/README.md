# Background Tasks With Progress Feedback

- Harness: Mastra
- Sourced: 2026-05-29

## What it is
Mastra now supports background tasks for long-running agent work, with explicit progress feedback during extended tool calls instead of forcing the user to wait behind a silent blocking turn.

## Evidence
- Feature index: [Mastra features archive](https://mastra.ai/blog/category/features)
- Official releases: [mastra-ai/mastra releases](https://github.com/mastra-ai/mastra/releases)
- First-party details:
  - the Mastra features archive lists `Introducing Background Tasks for Mastra Agents` on May 7, 2026 and describes progress feedback during long-running tool calls as the core capability
  - recent releases already pushed Mastra toward explicit process control with background process handles, process output retrieval, workflow suspend or resume continuity, and better observability around long-running work
  - the broader Studio and Cloud surface means those background runs plug into traces, logs, metrics, and experiments instead of existing as opaque detached jobs
- Latest development checkpoint:
  - by early May 2026 Mastra had moved from simple background process primitives toward user-visible background task progress for agent runs

## Product signal
Mastra is treating visible progress during long-running work as part of the runtime contract, not just a UI nicety. That matters because more harnesses are moving to remote, tool-heavy, and slower workflows where silent waiting destroys trust.
