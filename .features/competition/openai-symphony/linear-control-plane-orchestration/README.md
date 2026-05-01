# Linear Control-Plane Orchestration

- Harness: OpenAI Symphony
- Sourced: 2026-04-30

## What it is
Symphony turns a Linear project board into the control plane for coding agents so each eligible issue gets its own continuously managed implementation run.

## Evidence
- Official announcement: [An open-source spec for Codex orchestration: Symphony](https://openai.com/index/open-source-codex-orchestration-symphony/)
- Official spec: [SPEC.md](https://github.com/openai/symphony/blob/main/SPEC.md)
- First-party details:
  - the OpenAI announcement published on April 27, 2026 says every open task gets an agent, agents run continuously, and humans review the results
  - the announcement says agents only start work on tasks that are not blocked, so execution can unfold in parallel across a dependency graph
  - the spec defines Symphony as a long-running service that polls Linear on a fixed cadence, dispatches eligible work, and stops runs when issue state changes make them ineligible
  - the service boundary is explicit: Symphony reads tracker state and schedules work, while ticket comments, status changes, and PR links are typically handled by the coding agent itself
- Latest development checkpoint:
  - the public launch on April 27, 2026 framed the issue tracker itself, not the terminal, as the primary orchestration surface

## Product signal
Symphony is pushing the market past session-centric coding agents toward board-native orchestration, where managing work items replaces manually supervising individual runs.
