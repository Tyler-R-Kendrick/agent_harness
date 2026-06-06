# Summary Diff For Linear Feature Generation

Updated: 2026-06-06
Baseline: `.features/Summary.md` refreshed through the 2026-06-05 Claude Code corpus.
Diff type: additive updates after the 2026-06-06 Hermes Agent refresh

## Net new normalized features

### Added: Browser-native runtime administration for channels, MCP, credentials, and memory
- Why now: the refreshed Hermes Agent corpus adds a first-party browser admin surface that goes well beyond session viewing and starts owning live runtime configuration.
- Research delta:
  - Hermes `v0.16.0` says the web dashboard now includes browser pages for messaging channels, MCP catalog administration, credentials, webhooks, memory, gateway controls, and a system page
  - the same release adds pluggable OIDC and username-password login for that browser surface, making it a governed control plane instead of an unauthenticated localhost convenience view
  - the dashboard docs still preserve the existing session, logs, config, and analytics surfaces, so the new admin pages layer live configuration on top of runtime observability
  - across the competitor set, this pushes a recurring idea into sharper focus: operators want to wire and govern the harness from the browser, not by editing config files on the host

## Expanded normalized features

### Expanded: Multi-surface continuity
- Why now: the refreshed Hermes Agent corpus now includes a first-party native desktop app that can steer local or remote Hermes runtimes without breaking session continuity.
- Research delta:
  - Hermes now documents a native desktop app for macOS, Windows, and Linux rather than only CLI, dashboard, mobile, and messaging surfaces
  - the `v0.16.0` release says each desktop profile can target a different remote Hermes gateway over OAuth or username/password while still sharing session links inside one window
  - the desktop docs keep the same sessions, skills, memory, and config across desktop, CLI, and gateway surfaces, which makes the new GUI a true continuation surface rather than a separate product

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: the refreshed Hermes Agent corpus adds a stronger distinction between observability and live administration in the same browser control plane.
- Research delta:
  - Hermes now pairs its existing dashboard status, sessions, logs, and analytics pages with new admin pages for channels, MCP, credentials, webhooks, memory, and gateway controls
  - this makes the browser surface responsible for both seeing runtime state and reconfiguring the infrastructure that shapes future runs
  - the release effectively upgrades Hermes from "operator console" to "operator console plus runtime admin console"

## Linear-ready feature payloads

### Proposed Linear feature: Add browser-native runtime administration for channels, MCP, credentials, and memory
- Linear issue title:
  - `Add browser-native runtime administration for channels, MCP, credentials, and memory`
- Suggested problem statement:
  - `agent-browser` already has runtime state, tools, and operator surfaces, but the harness still depends too heavily on file edits, local setup knowledge, or ad hoc scripting when an operator needs to rewire channels, MCP servers, credentials, webhooks, memory policy, or auth settings. Competitors are moving this wiring into governed browser consoles so teams can inspect the current runtime, make targeted configuration changes, and keep operating without shell access to the host. Without that control plane, the product is harder to administer, harder to delegate safely, and more brittle in shared or hosted environments. The product needs a browser-native runtime administration surface that separates observability from destructive edits while making the harness configurable by authorized operators in one place.`
- One-shot instruction for an LLM:
  - Implement a browser-native runtime administration console for `agent-browser`: add a governed operator UI that can inspect and update messaging or ingress channels, MCP server registrations and catalog entries, runtime credentials and webhooks, memory policy controls, and auth-provider wiring; preserve a clear split between read-only observability views and destructive configuration actions; require role-aware permissions and confirmation for risky edits; and store durable audit history so operators can see what changed, who changed it, and how that change affects future local, background, and remote runs.
