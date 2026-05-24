# Summary Diff For Linear Feature Generation

Updated: 2026-05-24
Baseline: `.features/Summary.md` refreshed from the 2026-05-23 Claude Cowork-updated corpus.
Diff type: additive update after Hermes Agent feature refresh

## Net new normalized features

### Added: Harness-managed subscription proxies and embeddable model endpoints
- Why now: the Hermes refresh adds a new first-party subscription proxy and reinforces that Hermes sees external embedding as part of the harness, not a bolt-on integration hack.
- Research delta:
  - Hermes now documents a local subscription proxy that serves OpenAI-compatible clients while attaching and refreshing the real upstream credential itself
  - the docs explicitly distinguish the subscription proxy from the agent API server, which means Hermes separates "reuse my model subscription" from "call the harness as an agent backend"
  - the latest feature overview keeps the API server inside the core harness surface, so external embedding is now a first-class product direction rather than a side utility
  - the same refresh also strengthens Hermes' operator and continuity story through dashboard plugins, explicit session handoff, and richer Kanban supervision, which makes a reusable external endpoint more credible as part of the same control plane

### Expanded: Multi-surface continuity
- Why now: the Hermes refresh adds explicit first-party `/handoff <platform>` session transfer instead of leaving continuity implied.
- Research delta:
  - Hermes can move a live CLI conversation into a destination messaging platform while keeping the same session id and full role-aware transcript
  - the gateway surface now covers a larger official platform set, including Microsoft Teams and LINE alongside the earlier chat adapters
  - sessions remain centrally searchable with full-text history, so handoff does not create a fresh disconnected thread of record

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: the Hermes dashboard now looks more like a local control plane than a thin settings page.
- Research delta:
  - the current dashboard exposes status, session search, logs, usage analytics, cron management, config editing, env-key management, and skill toggles through a documented REST surface
  - Hermes now treats dashboard tabs, themes, and plugin routes as part of the core management story
  - the Kanban board itself is surfaced as a dashboard plugin with live updates, orchestration controls, and per-task supervision details

### Added: Add a local OpenAI-compatible proxy and embeddable agent endpoint
- Why now: `agent-browser` already owns provider configuration, tool permissions, and session state, but it does not yet let adjacent apps safely reuse that control plane. The Hermes refresh shows a clearer product split between "proxy my authenticated model access" and "invoke the full agent runtime", which would let external tools integrate without copying secrets or bypassing harness policy.
- Linear issue:
  - Pending external publication in this session if the Linear plugin remains non-callable in this environment; the feature brief below is the canonical issue payload
- Linear issue title:
  - `Add a local OpenAI-compatible proxy and embeddable agent endpoint`
- Suggested problem statement:
  - `agent-browser` already manages provider credentials, tool permissions, and agent session state, but external apps still need their own direct model keys or custom integrations. That duplicates secrets, bypasses the harness's policy layer, and forces downstream tools to rebuild routing and auth refresh logic that the harness already owns. Users need a safe way to let approved local clients reuse configured models or selected agent capabilities through an OpenAI-compatible surface, while keeping the distinction between simple model proxying and full agent execution explicit and auditable.`
- One-shot instruction for an LLM:
  - Implement a local OpenAI-compatible proxy and embeddable agent endpoint for `agent-browser`: expose approved configured models and, separately, selected agent-backed routes to local external clients; reuse the harness's existing provider credentials, auth-refresh logic, policy checks, and observability; make proxy-mode and agent-runtime mode distinct in config, logs, and UX; require explicit client allowlisting and visible permission scopes; and return structured session or request metadata so downstream apps can audit which model or agent path handled each call.
