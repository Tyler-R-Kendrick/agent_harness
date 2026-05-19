# Agent Session Sharing And Live Remote Steering

- Harness: Warp
- Sourced: 2026-05-19

## What it is
Warp lets users open a remote or shared agent run as a live session, inspect the full trajectory, keep chatting with the agent after the first task completes, and fork the work back to local.

## Evidence
- Official docs: [Session sharing](https://docs.warp.dev/knowledge-and-collaboration/session-sharing/)
- Official docs: [Viewing Cloud Agent Runs](https://docs.warp.dev/agent-platform/cloud-agents/viewing-cloud-agent-runs)
- First-party details:
  - shared sessions expose commands, logs, context, plans, and outputs while the remote VM is still running
  - follow-up turns can be sent back into the remote environment after the original task completes, as long as the environment is still active
  - cloud runs can be viewed in Warp or directly in a browser, even if the viewer does not have Warp installed
  - if the remote VM shuts down, Warp exposes a `Fork to local` path so the same run can continue on the developer's machine
- Latest development checkpoint:
  - Warp's May 19, 2026 cloud-session docs emphasize observability, live steering, and cloud-to-local continuation as the default remote-run experience, not a read-only transcript view

## Product signal
Warp is productizing the remote run itself as a live collaborative artifact, which raises the bar for handoff, debugging, and post-run intervention across teammates and devices.
