# Agent Session Sharing And Live Remote Steering

- Harness: Warp
- Sourced: 2026-04-30

## What it is
Warp lets users share agent sessions, watch work remotely, and take over or fork the run instead of treating the agent outcome as an opaque black box.

## Evidence
- Official docs: [Agent Session Sharing](https://docs.warp.dev/knowledge-and-collaboration/session-sharing/agent-session-sharing)
- Official docs: [Viewing Cloud Agent Runs](https://docs.warp.dev/agent-platform/cloud-agents/viewing-cloud-agent-runs)
- First-party details:
  - Warp exposes session sharing as a formal Cloud Agent capability
  - users can observe the remote run while it is happening rather than only reading a final summary
  - live remote sessions support human intervention and continuation instead of a fire-and-forget job model
  - the sharing model is designed for collaboration and debugging, not just vanity links
- Latest development checkpoint:
  - Warp's current Cloud Agent docs emphasize inspectability and collaboration during execution, not only after execution

## Product signal
Warp is productizing the agent run itself as a collaborative artifact, which is useful for review, debugging, and handoff across devices or teammates.
