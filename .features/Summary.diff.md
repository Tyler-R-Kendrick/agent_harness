# Summary Diff For Linear Feature Generation

Updated: 2026-05-01
Baseline: `.features/Summary.md` updated from the 2026-05-01 seventeen-harness corpus.
Diff type: additive update after Mastra research

## Net new normalized features

### Added: Durable suspend resume state and approval gates
- Why now: Mastra treats pause, approval, and resume as persisted runtime states instead of forcing the user to restart a long-running flow.
- Research delta:
  - the current Mastra docs say workflows can suspend, persist state, and resume later through `.resume()` and related stream APIs
  - the `suspend()` reference says the workflow state is persisted and can be continued later
  - the Playground suspend/resume blog says `resumeStream` can close a stream on suspend and later continue from the same point instead of replaying the run

### Expanded: Parallel agent orchestration
- Why now: Mastra's current network and supervisor direction shows a more workflow-native way to coordinate delegating agents than the current summary captured.
- Research delta:
  - the Mastra agents surface explicitly supports agent networks
  - the AgentNetwork evolution post says `.network()` became the main routing primitive on `Agent`
  - the February 26, 2026 release notes added a supervisor pattern with delegation hooks, completion scoring, memory isolation, and approval propagation

### Expanded: Persistent memory plus project instructions
- Why now: Mastra's Observational Memory work pushes memory beyond simple conversation recall into a stable long-horizon runtime architecture.
- Research delta:
  - the Mastra memory surface spans working memory, conversation history, semantic recall, and memory processors
  - the February 9, 2026 Observational Memory research post describes background Observer and Reflector agents that maintain a dense observation log
  - the March 25, 2026 releases added model-by-input-size routing for observational memory workloads

### Expanded: Operator-facing orchestration telemetry
- Why now: Mastra is broadening telemetry into a combined deploy, trace, score, memory, and experiment control plane.
- Research delta:
  - the Mastra Cloud docs say deployments expose agents, tools, and workflows with a dashboard for status, logs, and configuration
  - the public cloud page adds traces, logs, metrics, scorers, experiments, agent versioning, and memory inspection
  - the April 2026 releases say CloudExporter now ships logs, metrics, scores, and feedback in addition to spans

### Added: Add durable suspend and resume checkpoints for browser-agent runs
- Why now: `agent-browser` still handles many waits and approvals as thread-level interruption instead of a persisted run state that can be resumed safely.
- Linear issue title:
  - `Add durable suspend/resume checkpoints for browser-agent runs`
- Suggested problem statement:
  - `agent-browser` cannot yet persist a live browser task at the moment it needs approval, credentials, or delayed human input, which forces users to re-drive the run or trust fragile transcript-only continuity.
- One-shot instruction for an LLM:
  - Design and implement persisted suspend/resume checkpoints for `agent-browser` so browser-capable runs can pause on human approval or missing input, save execution state plus artifacts, close and later restore streaming surfaces, and resume from the same browser-task boundary with clear audit history, timeout policy, and operator controls.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add durable suspend/resume checkpoints for browser-agent runs`
