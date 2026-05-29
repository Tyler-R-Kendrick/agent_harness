# Agent Editor Draft, Publish, Rollback, And Editor API

- Harness: Mastra
- Sourced: 2026-05-29

## What it is
Mastra Studio now lets teams edit live agent behavior without code changes through a versioned Agent Editor with draft and publish lifecycle controls, rollback, side-by-side comparison, and a matching API for automation.

## Evidence
- Official announcement: [Introducing Agent Editor](https://mastra.ai/blog/introducing-agent-editor)
- Official platform launch: [Announcing Mastra Platform](https://mastra.ai/blog/announcing-mastra-platform)
- First-party details:
  - the Agent Editor announcement says subject matter experts and product teams can update agent instructions, tools, MCP clients, variables, and display conditions from Studio without editing code or redeploying
  - Mastra says changes are stored separately from the code-defined baseline, with draft and publish workflow, version history, rollback, and side-by-side comparison
  - the same post says `mastra.getEditor()` and the `/api/stored/agents` API expose the full editor surface programmatically, including memory, scorers, subagents, workflows, and conditional variants
  - the platform launch says Agent Editor is part of the broader Studio control plane, alongside datasets, experiments, logs, traces, and role-aware team access
- Latest development checkpoint:
  - Agent Editor launched on April 8, 2026 and is positioned as a first-class production iteration surface rather than a local-only prompt tweak tool

## Product signal
Mastra is shifting post-launch agent tuning away from PR-only workflows and into a governed runtime editor. That is a strong competitive signal for harnesses that want non-engineers to improve agent behavior safely without forking the deployment pipeline.
