# Multi-Harness Cloud Control Plane And Cross-Harness Memory

- Harness: Warp
- Sourced: 2026-05-31

## What it is
Warp's May 19, 2026 Oz update turns Warp into a control plane that can launch, track, govern, and steer multiple external harnesses in the cloud while sharing orchestration, audit, and long-term memory infrastructure above them.

## Evidence
- Official post: [A single pane of glass for managing all of your cloud agents](https://www.warp.dev/blog/multi-harness-cloud-agent-orchestration)
- Official post: [Introducing Oz](https://www.warp.dev/blog/oz-orchestration-platform-cloud-agents)
- First-party details:
  - Oz now supports Claude Code and Codex in addition to Warp Agent, with one management layer for launch, tracking, steering, and audit logs.
  - the same launch adds automatic multi-agent orchestration with parallel subagents coordinated locally or in the cloud.
  - Warp introduced Agent Memory in research preview as a cross-harness memory layer that can form memories from Codex and Claude Code sessions, not just Warp-native runs.
  - the memory layer is described as writable and pluggable, with sources from files, skills, MCPs, databases, and enterprise apps.
  - the same update adds per-team billing, individual credit caps, and least-privilege access controls for internal services.
  - Warp also expanded self-hosting choices to Kubernetes, direct execution, and existing remote development environments.
- Latest development checkpoint:
  - On May 19, 2026, Warp publicly positioned Oz as the first multi-harness control plane for cloud agents and tied memory, governance, and self-hosting to that layer rather than to any single agent runtime.

## Screenshots and demos
- Official visual: the launch post shows "Oz is the first multi-harness control plane for cloud agents including Claude Code, Codex, and whatever comes next."
- Official visual: the post also shows a dedicated image for running Claude Code, Codex, and Warp Agent side by side in Oz.

## Product signal
Warp is climbing one layer up the stack: instead of competing only as one more coding agent, it now competes as the orchestration and governance layer above interchangeable harnesses.
