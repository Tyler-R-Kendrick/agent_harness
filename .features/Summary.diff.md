# Summary Diff For Linear Feature Generation

Updated: 2026-05-05
Baseline: `.features/Summary.md` refreshed from the 2026-05-04 twenty-two-harness corpus.
Diff type: additive update after GitHub Copilot refresh research

## Net new normalized features

### Added: Policy-governed partner-agent control planes
- Why now: GitHub Copilot is no longer just shipping its own cloud agent. It now hosts Claude and Codex inside the same task surface, with shared governance and a growing model picker.
- Research delta:
  - GitHub Docs now document third-party agents for Claude and Codex alongside Copilot cloud agent
  - the same GitHub task surfaces now support partner agents across the agents tab, issues, pull requests, GitHub Mobile, and VS Code
  - the April 14, 2026 changelog adds per-agent model selection on github.com for Claude and Codex
  - GitHub applies the same security protections and policy controls to partner agents as it does to its own cloud agent

### Expanded: Parallel agent orchestration
- Why now: GitHub Copilot now treats specialization as part of the orchestration layer, not just as separate named prompts.
- Research delta:
  - custom agent profiles can run as subagents with separate context windows
  - subagent work can run in parallel
  - third-party agents further broaden GitHub's multi-agent execution model

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: GitHub Copilot now exposes both lightweight and heavier-weight reusable packaging surfaces instead of only custom instructions.
- Research delta:
  - prompt files package reusable workspace prompts in Markdown
  - Agent Skills package instructions, scripts, and resources
  - Copilot can reuse existing `.claude/skills` repositories instead of forcing a new skill format

### Expanded: Multi-surface continuity
- Why now: GitHub now gives cloud-agent sessions a broader control surface than the original terminal-plus-GitHub story.
- Research delta:
  - session tracking now spans the agents tab, GitHub CLI, Raycast, VS Code, JetBrains, Eclipse, and GitHub Mobile
  - users can inspect session logs and steer running tasks from those surfaces
  - GitHub is explicitly turning session continuity into a cross-client product feature

### Expanded: Persistent memory plus project instructions
- Why now: GitHub is broadening grounded context from private setup into reusable, shareable artifacts.
- Research delta:
  - Spaces can now be shared publicly or individually
  - files can be added to Spaces directly from the github.com code viewer
  - GitHub is preserving RBAC while making context packs easier to publish and reuse

### Expanded: Background execution without stealing focus
- Why now: Copilot is pushing agent execution closer to the cursor instead of forcing every autonomous flow into a dedicated side panel.
- Research delta:
  - agent mode in IDEs now spans richer inline/editor-native flows
  - April 24, 2026 JetBrains notes add inline agent mode in public preview
  - the same update adds global auto-approve and granular defaults for commands and file edits

### Added: Add a policy-governed partner-agent control plane and model picker
- Why now: `agent-browser` already has its own harness and orchestration surfaces, but it cannot yet host multiple agent backends behind one shared session, governance, and review workflow the way GitHub Copilot now can.
- Linear issue title:
  - `Add a policy-governed partner-agent control plane and model picker`
- Suggested problem statement:
  - `agent-browser` can run its own agent stack, but it lacks a shared control plane for switching or delegating across multiple agent backends while keeping one consistent policy, review, and audit model for browser-agent tasks.
- One-shot instruction for an LLM:
  - Implement a partner-agent control plane for `agent-browser` that can host multiple agent backends behind one session UX, unify permissions and audit logging, preserve the same issue, diff, and review workflow regardless of backend, and expose per-agent model selection without fragmenting run history or browser evidence.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add a policy-governed partner-agent control plane and model picker`
