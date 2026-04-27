# Summary Diff For Linear Feature Generation

Updated: 2026-04-27
Baseline: `.features/Summary.md` updated from the 2026-04-26 nine-harness corpus.
Diff type: additive update after OpenCode research

## Net new normalized features

### Expanded: Parallel agent orchestration
- Why now: OpenCode reinforces that visible parallel sessions and navigable subagent trees are becoming a default harness expectation, not a premium edge case.
- Research delta:
  - OpenCode exposes `Multi-session` on the homepage, documents parent/child session navigation, and ships built-in primary and subagent roles.

### Expanded: Skills and reusable browser workflows
- Why now: OpenCode shows that repeatable workflows are converging around repo-local command packs and portable `SKILL.md` definitions, not just marketplace-style plugins.
- Research delta:
  - OpenCode supports project/global command files under `.opencode/commands/`
  - OpenCode discovers project/global skills across `.opencode`, `.claude`, and `.agents`

### Expanded: External tool connectivity and policy control
- Why now: OpenCode couples MCP integration with explicit tool-permission policy, which is stronger than simply exposing more integrations.
- Research delta:
  - OpenCode supports local and remote MCP servers plus custom tools
  - permissions can be allowed, denied, or routed to approval globally or per agent

### Added: Shareable session links and debug handoff
- Why now: OpenCode treats session sharing as a first-class collaboration primitive, with explicit privacy modes instead of an ad hoc export.
- Linear issue title:
  - `Share browser-agent runs with review-safe links`
- Suggested problem statement:
  - Review and debugging are slower than they need to be because browser-agent runs are hard to hand off intact without manually copying logs, screenshots, and narrative context.
- One-shot instruction for an LLM:
  - Design and implement shareable run links for browser-agent sessions with privacy modes, artifact redaction, expiration or unshare controls, and a review view that preserves prompts, tool calls, outputs, screenshots, and validation evidence.

### Added: Policy-driven agent permissions
- Linear issue title:
  - `Add policy-driven permission presets for agent actions`
- Suggested problem statement:
  - Browser-capable agents need more than a single autonomy toggle because teams want safe defaults for edits, shell commands, browser actions, and external tools.
- One-shot instruction for an LLM:
  - Implement granular permission presets with allow, ask, and deny outcomes for major action classes, support path or command pattern overrides, and let shared agents carry reviewed policy bundles for common workflows.

### Added: Project command packs for repeatable tasks
- Linear issue title:
  - `Ship project command packs for browser workflows`
- Suggested problem statement:
  - Teams repeat the same browser verification, triage, and debugging prompts, but the harness does not yet expose a clean project-local command layer for them.
- One-shot instruction for an LLM:
  - Implement project-local command packs for browser workflows with metadata, prompt templates, recommended agents, optional model hints, and a slash-command style launcher so repeated tasks become versioned repo assets.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended first Linear batch

1. `Share browser-agent runs with review-safe links`
2. `Add policy-driven permission presets for agent actions`
3. `Ship project command packs for browser workflows`
