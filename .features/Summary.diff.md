# Summary Diff For Linear Feature Generation

Updated: 2026-04-28
Baseline: `.features/Summary.md` updated from the 2026-04-26 nine-harness corpus.
Diff type: additive update after OpenCode research

## Net new normalized features

### Expanded: Parallel agent orchestration
- Why now: OpenCode reinforces that multi-session parallel work is becoming table stakes across coding harnesses, not a niche expert feature.
- Research delta:
  - OpenCode lists `Multi-session` on the product page and frames parallel agents as a headline workflow.
  - OpenCode also distinguishes between primary agents and subagents in current docs.

### Added: Shareable sessions and debug handoff
- Why now: OpenCode turns session sharing into an explicit product capability instead of leaving handoff to screenshots or copied logs.
- Linear issue title:
  - `Share review-safe browser agent runs`
- Suggested problem statement:
  - Browser-agent runs are hard to review asynchronously because evidence, decisions, and artifacts stay trapped in the original session.
- One-shot instruction for an LLM:
  - Design and implement a private-by-default session sharing feature that can publish a sanitized run artifact containing transcript excerpts, screenshots, DOM assertions, console/network evidence, and linked diffs; include retention controls, explicit redaction points, and a stable review URL.

### Added: Policy-driven permissions
- Why now: OpenCode exposes approvals as a configurable product surface, including per-tool and per-agent rules, which makes autonomy safer without hiding the policy model.
- Linear issue title:
  - `Add policy-driven permission presets`
- Suggested problem statement:
  - Browser-capable agents need flexible approval controls, but the current permission model is too implicit for teams to tune confidently.
- One-shot instruction for an LLM:
  - Implement permission presets for browser agents with global and per-agent overrides, explicit allow/ask/deny behavior for tool classes, path and command pattern support, and a UI that shows which policy allowed or blocked each action.

### Added: Project command packs for repeatable workflows
- Why now: OpenCode packages repeatable agent behavior as custom slash commands with agent and model bindings, reducing prompt duplication.
- Linear issue title:
  - `Ship project command packs for browser workflows`
- Suggested problem statement:
  - Repeated browser workflows such as smoke tests, bug repro, and verification runs are still encoded as ad hoc prompts instead of reusable project commands.
- One-shot instruction for an LLM:
  - Design a command-pack system for browser workflows where projects can define named commands with instructions, arguments, agent bindings, model preferences, and evidence requirements; surface them in task intake and make them easy to version and share.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Share review-safe browser agent runs`
2. `Add policy-driven permission presets`
3. `Ship project command packs for browser workflows`
