# Summary Diff For Linear Feature Generation

Updated: 2026-05-06
Baseline: `.features/Summary.md` refreshed from the 2026-05-04 twenty-two-harness corpus.
Diff type: additive update after Cursor refresh research

## Net new normalized features

### Added: Enterprise model governance and spend-aware operations
- Why now: Cursor is showing that once harnesses span local chats, cloud agents, automations, and reviewer agents, admins need policy and budget controls that work across all of them.
- Research delta:
  - Cursor's May 4, 2026 changelog adds provider-level and model-level allow or block lists
  - admins can default-block newly released providers or model versions
  - soft spend limits now trigger automatic alerts at 50%, 80%, and 100%
  - usage analytics can now be broken down by user and by surface, including clients, Cloud Agents, automations, Bugbot, and Security Review

### Added: Always-on specialist security review agents
- Why now: Cursor has turned security-specific reviewer agents into a first-class part of the harness instead of leaving this work to generic coding agents or separate security tools.
- Research delta:
  - Cursor Security Review adds `Security Reviewer` for inline PR review and `Vulnerability Scanner` for scheduled repo scans
  - the reviewer explicitly checks auth regressions, privacy/data handling, prompt injection, and unsafe agent auto-approvals
  - findings include inline severity and remediation guidance
  - teams can wire in existing SAST, SCA, and secret scanners via MCP and send scan updates to Slack

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Cursor is tightening the governance side of its plugin platform, not only the rendering side.
- Research delta:
  - team marketplaces can now be created without first connecting a repository
  - first-party plugins now support explicit `Default Off`, `Default On`, and `Required` install behavior
  - the governed package surface spans MCP servers, skills, subagents, rules, and hooks

### Added: Add security review agents and scheduled vulnerability scans
- Why now: `agent-browser` already has review and automation ambitions, but it does not yet have specialized continuous security agents that can review diffs and run scheduled repo scans inside the same harness and governance layer.
- Linear issue title:
  - `Add security review agents and scheduled vulnerability scans`
- Suggested problem statement:
  - `agent-browser` can run browser-capable agents and validation flows, but it lacks specialized security reviewers that can continuously inspect pull requests, run scheduled vulnerability scans, and surface severity-tagged findings in the same operational workflow.
- One-shot instruction for an LLM:
  - Implement specialized security review agents for `agent-browser` that can inspect pull-request diffs and scheduled repository state, emit inline severity-tagged findings with remediation guidance, integrate existing security tools through the harness tool layer, and deliver scheduled scan updates through the same automation and review surfaces already used for browser-agent work.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add security review agents and scheduled vulnerability scans`
