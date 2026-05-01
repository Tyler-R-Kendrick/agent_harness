# Summary Diff For Linear Feature Generation

Updated: 2026-04-30
Baseline: `.features/Summary.md` updated from the 2026-04-30 fourteen-harness corpus.
Diff type: additive update after Warp research

## Net new normalized features

### Added: Agent-ready remote environments and trigger wiring
- Why now: Warp makes hosted execution environments a first-class product object, then wires them into schedules and trigger surfaces such as Linear, Slack, and GitHub Actions instead of assuming a human-open terminal.
- Research delta:
  - Warp documents reusable Cloud Agent setup rather than only local terminal sessions
  - integrations include GitHub, Linear, and Slack from the main Cloud Agent surface
  - GitHub Actions and scheduled runs are documented as native launch paths for hosted agents

### Expanded: Shareable sessions and debug handoff
- Why now: Warp pushes the run-sharing model toward live collaboration by letting people inspect and steer remote sessions while the agent is still working.
- Research delta:
  - Cloud Agent docs include both session sharing and live remote sessions
  - the product allows observation during execution, not only a final artifact after execution
  - collaborative intervention is part of the story, which is stronger than plain transcript export

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Warp Drive continues the shift from ad hoc prompts to team-discoverable workflows and notebooks that mix runnable blocks with explanatory operational context.
- Research delta:
  - Workflows package reusable command sequences with variables
  - Notebooks combine runnable terminal blocks and explanatory text
  - Drive assets form a searchable team knowledge layer the agent can work within

### Added: Build reusable remote execution environments for `agent-browser`
- Why now: Browser-agent automations still depend too much on the operator's current machine state, which makes scheduling, chat-triggered runs, and CI-driven work harder than they should be.
- Linear issue title:
  - `Build remote execution environments for agent-browser`
- Suggested problem statement:
  - `agent-browser` lacks a reusable hosted environment model, so every long-running or remotely triggered automation has to rediscover repo setup, dependencies, and secrets at run time.
- One-shot instruction for an LLM:
  - Design and implement remote execution environments for `agent-browser` that capture repo bootstrap, dependency install, browser setup, secrets injection, and validation commands once, then let later runs launch against that environment predictably with audit logs, replayable parameters, and environment health checks.

### Added: Trigger browser agents from Linear Slack and CI
- Why now: Warp shows that hosted agents become more valuable when real project events can launch them directly instead of waiting for a human to open the product first.
- Linear issue title:
  - `Add event triggers for browser-agent runs`
- Suggested problem statement:
  - `agent-browser` runs are still launched mostly by hand, which limits recurring maintenance, issue-driven execution, and repo-event automation.
- One-shot instruction for an LLM:
  - Implement an event-trigger layer for `agent-browser` that can start runs from issue-tracker events, chat commands, schedules, and CI webhooks, route each launch into an isolated browser-agent session, preserve launch context in the run timeline, and enforce per-trigger permission and environment policies.

### Added: Add live collaborative steering for remote agent runs
- Why now: Warp demonstrates that remote runs become easier to trust when humans can watch, intervene, and fork while the work is still in progress.
- Linear issue title:
  - `Add live steering and handoff for remote agent runs`
- Suggested problem statement:
  - Remote browser-agent executions are still too opaque once launched, which makes debugging, teammate handoff, and mid-run correction slower than necessary.
- One-shot instruction for an LLM:
  - Build a live remote-session surface for `agent-browser` that streams current step state, browser evidence, tool output, and validation progress to observers, allows authorized humans to pause, steer, or fork the run, and preserves those interventions as first-class timeline events.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Build remote execution environments for agent-browser`
2. `Add event triggers for browser-agent runs`
3. `Add live steering and handoff for remote agent runs`
