# Summary Diff For Linear Feature Generation

Updated: 2026-05-30
Baseline: `.features/Summary.md` refreshed through the 2026-05-29 Mastra corpus.
Diff type: additive updates after the GitHub Copilot refresh

## Net new normalized features

### Added: Repository-scoped memory governance with guided forgetting
- Why now: the refreshed GitHub Copilot corpus shows memory becoming an administered system rather than a quiet personalization layer. The current product line now exposes scope-aware enablement, review, deletion, and disablement controls across both UI and CLI surfaces.
- Research delta:
  - GitHub Copilot Memory now spans repository facts and user preferences, and those memories can be reused across cloud agent, code review, and Copilot CLI
  - enterprise owners can force enablement, force disablement, or delegate the decision to organization owners, while repository owners can review and delete stored facts
  - the May 26, 2026 release adds clearer forgetting guidance, a repository-level off switch, and more CLI memory controls instead of leaving deletion buried in web-only settings
  - current docs show repository, organization, enterprise, and user controls as separate levers, which is a stronger governance model than a single global toggle

## Expanded normalized features

### Expanded: Parallel agent orchestration
- Why now: GitHub Copilot now has a dedicated desktop app that treats parallel branch-isolated sessions as a first-class operations surface instead of a side effect of separate terminals.
- Research delta:
  - the Copilot app runs multiple isolated sessions at the same time, each with a dedicated git worktree and branch
  - session modes are explicit in the app: `Interactive`, `Plan`, and `Autopilot`
  - the same app positions the user as a director of multiple concurrent workstreams rather than a passenger in one terminal

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: GitHub has moved skills and MCP settings into the Copilot app itself instead of keeping them trapped in the CLI or repo file layer.
- Research delta:
  - current Copilot app docs say repo or CLI-configured skills are automatically available in the app
  - global instructions now apply across all app sessions
  - MCP servers can be managed from app settings, including popular catalog servers and custom servers

### Expanded: Multi-surface continuity
- Why now: GitHub Copilot's remote-control and app work now covers more execution origins and more follow-through surfaces than the prior snapshot.
- Research delta:
  - remote control for Copilot CLI is now generally available across mobile, web, VS Code, and JetBrains
  - remote sessions now support non-GitHub repositories and plain directories, reducing the dependency on GitHub-hosted repos for follow-through
  - the new Copilot app adds another GitHub-native control surface without forking the underlying CLI agent model

### Expanded: Git/PR-native execution
- Why now: the Copilot app makes GitHub issue intake and PR landing a single local workflow instead of a sequence of IDE, browser, and terminal hops.
- Research delta:
  - users can browse issues, pick one up, let the agent create a branch, run tests, and then review, open, and merge the PR from the same app
  - scheduled workflows are now part of the app surface, so recurring issue-to-agent execution is no longer limited to cloud-only or hidden automation flows
  - this turns GitHub-native agent work into a purpose-built desktop loop rather than a thin wrapper around chat or pull requests

## Linear-ready feature payloads

### Proposed Linear feature: Add repository-scoped memory governance with guided forgetting
- Linear issue title:
  - `Add repository-scoped memory governance with guided forgetting`
- Suggested problem statement:
  - `agent-browser` already depends on long-lived instructions, run history, and durable context, but its memory behavior is still too implicit. Teams need stronger trust controls before they will allow the harness to accumulate repository facts, user preferences, or operational heuristics over time. Without explicit scope-aware policies, repository owners cannot review or delete stale entries, admins cannot disable memory without disabling the rest of the harness, and users cannot confidently ask the system to forget something and know what actually changed. The harness needs a governed memory subsystem with review, deletion, disablement, and guided-forgetting flows that work across local, browser, and background agent experiences.`
- One-shot instruction for an LLM:
  - Implement memory governance for `agent-browser`: add explicit memory scopes for workspace, project, repository, organization, and user context; persist provenance for every learned memory; let repository owners and authorized operators review, delete, disable, and re-enable stored memories from the UI and API; support guided forgetting directly from chat so a user can ask the harness to forget something and be taken to the exact entry or entries involved; enforce scope-aware policies and kill switches without disabling unrelated harness features; and surface why a memory was used, when it was validated, and who can remove it.
