# Summary Diff For Linear Feature Generation

Updated: 2026-05-23
Baseline: `.features/Summary.md` refreshed from the 2026-05-22 Claude Code-updated corpus.
Diff type: additive update after Claude Cowork feature refresh

## Net new normalized features

### Added: Split-trust execution planes with graceful sandbox fallback
- Why now: the refreshed Claude Cowork corpus adds a much clearer first-party description of how Anthropic is separating host-native actions from isolated code execution, including what continues working when the VM fails and which policy controls apply to each layer.
- Research delta:
  - Cowork now documents two execution environments on-device: a host-native agent loop for conversation, file, web, and local plugin actions, and an isolated Linux VM for shell commands and generated code
  - Anthropic explicitly says file and web tools can keep working if the VM is unavailable, while shell and code actions surface a workspace-unavailable state
  - Team and Enterprise admins can independently disable local MCP servers or desktop extension servers on managed devices, which reinforces that Cowork's control surface is not one undifferentiated sandbox
  - network egress and enterprise policy are described as session-scoped controls for code execution, while browser-style tools and Chrome automation sit on separate paths

### Expanded: Persistent memory plus project instructions
- Why now: the Cowork refresh adds a current project workspace model with local storage, project-specific instructions, project-scoped memory, and project-bound scheduled tasks.
- Research delta:
  - Cowork projects can be created from scratch, imported from Claude chat projects, or wrapped around local folders
  - each project now packages files, context, instructions, memory, and scheduled tasks together
  - project memory is explicitly scoped per workspace rather than shared account-wide

### Expanded: Enterprise governance and observability
- Why now: the Cowork refresh broadens the governance picture from "some admin controls" to a fuller analytics and telemetry model.
- Research delta:
  - Cowork now has dedicated analytics surfaces and Analytics API coverage
  - OpenTelemetry exports include prompts, tool and MCP calls, file access, approval decisions, tokens, cost, and errors
  - Anthropic is explicit that Compliance API coverage still does not include Cowork activity, making OTel the real monitoring path today

### Added: Add split-trust execution planes with graceful sandbox fallback
- Why now: `agent-browser` already spans local tools, browser tasks, and code execution, but it still treats execution as too monolithic. The Claude Cowork refresh shows a cleaner model where safer host-native actions can keep working under one permission regime while riskier code or shell execution lives behind stronger isolation and can fail independently without taking down the entire run.
- Linear issue:
  - Pending external publication in this session if the Linear plugin remains non-callable in this environment; the feature brief below is the canonical issue payload
- Linear issue title:
  - `Add split-trust execution planes with graceful sandbox fallback`
- Suggested problem statement:
  - `agent-browser` mixes lightweight host actions and higher-risk code execution into one broad execution story, which makes permissions harder to explain, policies harder to enforce, and failures harder to contain. Users and admins need a clearer boundary where browser, file-inspection, and other host-safe actions can keep working under explicit local permissions while shell and code execution run inside a stronger isolation layer with separate network policy. Without that split, a sandbox outage or policy block turns into a whole-session failure instead of a partial degradation the user can still work through.`
- One-shot instruction for an LLM:
  - Implement split-trust execution planes for `agent-browser`: keep chat, file inspection, browser work, and other host-safe actions in a host-native control layer with explicit permissions and visible action provenance; run shell commands and generated code in an isolated sandbox or worktree execution plane with separate network policy and status reporting; surface which plane each action used in the transcript and operator views; and when the sandbox is blocked or unavailable, degrade gracefully so host-safe actions continue while code actions show a clear blocked state instead of failing the entire run.
