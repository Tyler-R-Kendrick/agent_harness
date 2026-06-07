# OpenAI Symphony

- Harness: OpenAI Symphony
- Refreshed: 2026-06-07

## Current feature map
- `linear-control-plane-orchestration`: Linear board as the scheduler and dispatch surface.
- `linear-graphql-tool-and-agent-side-ticket-ops`: tracker writes stay in the agent toolchain.
- `observability-dashboard-and-json-api`: operator dashboard, JSON API, and runtime visibility.
- `dashboard-agent-detail-panel-and-recent-codex-activity`: clickable live session detail panel with stage, checklist, and recent activity.
- `blocked-session-surfacing-and-operator-input-queues`: input-required sessions pause visibly instead of burning retries.
- `tracker-backed-claim-leases-and-heartbeat-recovery`: durable worker leases survive restarts and surface ownership in the tracker plus dashboard.
- `jira-claim-leases-and-comment-marker-upserts`: tracker-portable lease markers extend durable orchestration into Jira without comment spam.
- `per-issue-token-usage-ledger-and-api-accounting`: durable per-issue token accounting survives completed runs and restarts.
- `per-issue-isolated-workspaces`: deterministic per-ticket workspaces.
- `mixed-local-and-ssh-worker-validation`: live end-to-end coverage for local and SSH worker execution.
- `proof-of-work-review-packets-and-safe-landing`: review packets, CI visibility, and merge handoff.
- `retries-continuations-and-blocker-aware-execution`: bounded retries, continuation turns, and dependency-aware dispatch.
- `workflow-md-contract-and-live-reload`: repo-owned workflow policy with guarded reload.
- `workflow-scoped-network-access-for-package-installs`: turn-level network access can be granted where bootstrap requires it.
- `workspacewrite-policies-retain-issue-workspace-roots`: explicit writable-root policies keep the active issue workspace writable while allowing extra roots.
- `workspace-hooks-and-bootstrap-automation`: lifecycle hooks for repo setup and cleanup.

## First-party sources used in this refresh
- [OpenAI announcement](https://openai.com/index/open-source-codex-orchestration-symphony/)
- [Repository README](https://github.com/openai/symphony/blob/main/README.md)
- [Service spec](https://github.com/openai/symphony/blob/main/SPEC.md)
- [Elixir reference README](https://github.com/openai/symphony/blob/main/elixir/README.md)
- Recent PRs: [#83](https://github.com/openai/symphony/pull/83), [#82](https://github.com/openai/symphony/pull/82), [#68](https://github.com/openai/symphony/pull/68), [#66](https://github.com/openai/symphony/pull/66), [#65](https://github.com/openai/symphony/pull/65), [#60](https://github.com/openai/symphony/pull/60), [#58](https://github.com/openai/symphony/pull/58)
