# Summary Diff For Linear Feature Generation

Updated: 2026-05-15
Baseline: `.features/Summary.md` refreshed from the 2026-05-14 thirty-harness corpus.
Diff type: additive update after Hermes Agent research

## Net new normalized features

### Added: Durable multi-agent task boards with recovery-aware dispatch
- Why now: Hermes has pushed beyond "spawn some helpers" into a board-backed coordination model where workers, retries, and human triage live in durable shared state.
- Research delta:
  - Hermes Kanban stores tasks, dependencies, comments, and worker state in `~/.hermes/kanban.db`
  - agents use a dedicated `kanban_*` toolset while humans can operate the same board through the CLI, slash commands, or dashboard
  - the board exposes explicit statuses such as `triage`, `todo`, `ready`, `running`, `blocked`, `done`, and `archived`
  - the May 7, 2026 `v0.13.0` release adds heartbeat, reclaim, zombie detection, auto-block on incomplete exit, per-task retries, and hallucination recovery
  - Hermes also ships a triage specifier flow that can expand rough cards into structured specs before dispatch

### Expanded: Persistent memory plus project instructions
- Why now: Hermes is pairing bounded memory with explicit, prompt-budget-aware project instruction discovery instead of loading all repo context up front.
- Research delta:
  - Hermes keeps separate `MEMORY.md` and `USER.md` files under `~/.hermes/memories/`
  - the docs define strict priority across `.hermes.md`, `AGENTS.md`, `CLAUDE.md`, and `.cursorrules`
  - subdirectory context files are discovered progressively when the agent starts touching those paths
  - external memory-provider plugins extend the built-in memory contract without replacing the repo-instruction layer

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Hermes now treats self-authored skills as an actively maintained library and exposes a much richer runtime plugin surface.
- Research delta:
  - the Curator grades, consolidates, pins, archives, and restores agent-created skills based on observed usage telemetry
  - plugin categories now include general plugins, memory providers, context engines, and model providers
  - plugin and shell hooks can veto tool calls, inject prompt context, rewrite tool results, and observe subagent/session lifecycle events
  - the v0.11.0 release expanded plugins to register slash commands, dashboard tabs, terminal-output transforms, and direct tool dispatch

### Expanded: Multi-surface continuity
- Why now: Hermes now spans many more first-party control surfaces than a CLI-plus-chat-bot framing suggests.
- Research delta:
  - the local dashboard can manage settings, sessions, gateway state, and embed the real TUI in a browser tab
  - ACP mode lets VS Code, Zed, and JetBrains use Hermes as an editor-native agent backend
  - the v0.9.0 release added native Termux or Android support
  - the gateway surface continued expanding across iMessage, WeChat, WeCom, and newer plugin-backed platforms

### Added: Add a durable multi-agent task board with recovery-aware dispatch
- Why now: `agent-browser` already has sessions, worktrees, checklists, and evidence surfaces, but it does not yet expose a durable board where many browser-agent workers can be assigned, retried, reclaimed, blocked, and supervised through shared task state.
- Linear issue:
  - `TK-64`
- Linear issue title:
  - `Add a durable multi-agent task board with recovery-aware dispatch`
- Suggested problem statement:
  - `agent-browser` can launch or coordinate agent work, but it does not yet provide a durable operator-facing task board with explicit states, assignee profiles, parent-child dependencies, retry policies, heartbeat or reclaim logic, blocked-for-human routing, and a UI where humans and agents act on the same shared work graph.
- One-shot instruction for an LLM:
  - Implement a durable multi-agent task-board system for `agent-browser` so browser-agent workers can claim assigned tasks, report heartbeat and progress, surface blockers, retry safely, recover abandoned work, and coordinate through a shared board with explicit task states, dependency links, assignee profiles, and human triage controls; wire it into the existing session, worktree, evidence, and automation surfaces so the board becomes a first-class control plane rather than a separate side system.

## Net new normalized features

### Added: Dual-mode reasoning backends with tool-aware state plumbing
- Why now: DeepSeek is exposing a stronger agent-backend contract than a normal model switch by making thinking versus non-thinking a first-class runtime mode with explicit replay rules when tool calls are involved.
- Research delta:
  - DeepSeek V4 exposes both `Expert Mode` and `Instant Mode` on the product side while keeping both `Thinking` and `Non-Thinking` modes on the API side
  - the `Thinking Mode` docs separate `reasoning_content` from the final answer instead of hiding reasoning inside one opaque response field
  - when a thinking-mode turn performs tool calls, DeepSeek requires the harness to pass `reasoning_content` back on all future turns or the API will reject the request
  - DeepSeek also exposes valid effort controls and automatically bumps some agent requests such as `Claude Code` and `OpenCode` to `max`

### Expanded: Embeddable agent runtimes and protocol surfaces
- Why now: DeepSeek is turning backend portability into a first-party product surface instead of leaving harness integration to community snippets.
- Research delta:
  - the API is documented as compatible with both OpenAI and Anthropic client ecosystems
  - the V4 release keeps the same base URL and only swaps the model name, which lowers migration friction
  - DeepSeek now publishes official setup or migration guides for harnesses such as GitHub Copilot, OpenCode, Hermes Agent, and Reasonix
  - the Copilot guide explicitly says users keep agent mode, tool calling, skills, and MCP while changing only the backend

### Expanded: Long-running context economics
- Why now: DeepSeek treats long-context agent loops as an operational system problem with explicit cache accounting instead of only a bigger context window.
- Research delta:
  - context caching is enabled by default for all users
  - overlapping request prefixes are fetched from disk cache instead of recomputed
  - responses expose `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens`
  - the cache is documented as a best-effort persistent layer for repeated long-text and multi-turn workloads

### Added: Add dual-mode reasoning backends with tool-aware state plumbing
- Why now: `agent-browser` can already route across models, but it still treats most providers like interchangeable chat endpoints and does not yet preserve provider-specific reasoning state or tool-loop replay requirements.
- Linear issue title:
  - `Add dual-mode reasoning backends with tool-aware state plumbing`
- Suggested problem statement:
  - `agent-browser` supports multiple providers and long-running tool use, but it does not yet provide a backend contract for explicit think versus non-think execution, valid reasoning-effort controls, persisted intermediate reasoning state, and provider-specific replay rules after tool-calling turns.
- One-shot instruction for an LLM:
  - Implement backend-aware reasoning modes for `agent-browser` so providers can declare explicit thinking and non-thinking execution modes, allowed effort controls, persistent reasoning-state persistence rules, and tool-turn replay requirements; use that contract to drive model routing, session storage, transcript rendering, and request serialization so switching between providers or modes does not corrupt long-running agent sessions.
  ...