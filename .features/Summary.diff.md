# Summary Diff For Linear Feature Generation

Updated: 2026-05-20
Baseline: `.features/Summary.md` refreshed from the 2026-05-19 Warp-updated corpus.
Diff type: additive update after OpenClaw feature refresh

## Net new normalized features

### Added: Queued steering with visible progress drafts
- Why now: the refreshed OpenClaw corpus makes human steering semantics much more explicit than the older notes captured. The product now has first-class queue modes, turn-boundary steering behavior, and a single visible progress draft for long-running work.
- Research delta:
  - OpenClaw exposes named queue modes like `steer`, `followup`, `collect`, and `steer-backlog`, instead of forcing every extra message through one ambiguous interruption path
  - steering happens at explicit tool boundaries, while follow-up and collect modes preserve the current run and drain later with debounce and overflow policies
  - progress drafts create one visible work-in-progress message that updates while the agent reads, plans, calls tools, or waits for approval, instead of flooding the thread with temporary chatter
  - the same harness links queued steering to durable session state and background-task records, so follow-up behavior is part of the runtime contract rather than just UI sugar

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: OpenClaw's current product surface goes beyond installable skills and into skill-generation and plugin-authoring infrastructure.
- Research delta:
  - OpenClaw now documents layered skill precedence across workspace, shared, managed, bundled, and plugin-shipped roots
  - the optional Skill Workshop can synthesize workspace skills from observed reusable procedures
  - the stable `2026.5.18` release added typed plugin helpers plus `openclaw plugins build`, `validate`, and `init`

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: OpenClaw now exposes a stronger operator plane than the previous lightweight corpus captured.
- Research delta:
  - the browser dashboard is explicitly an admin surface for chat, config, sessions, nodes, and exec approvals
  - detached ACP, subagent, cron, and CLI work now lands in durable task records with lifecycle state and requester linkage
  - the stable `2026.5.18` release highlights faster settings, cleaner chat and session controls, and responsive logs as part of the main product

### Added: Add queued steering with progress drafts and turn-boundary control
- Why now: `agent-browser` already preserves session history, but it still lacks an explicit contract for what happens when the user adds input during a long-running turn. There is no first-class choice between interrupt-now, queue-for-later, coalesce-followups, or steer-now-then-follow-up, and there is no single progress-draft surface that keeps the run visibly alive without spamming the thread.
- Linear issue:
  - Pending in this session unless Linear issue-creation tools become available; no `LINEAR_API_KEY` is present locally and the Linear connector has not surfaced callable create-issue tools
- Linear issue title:
  - `Add queued steering with progress drafts and turn-boundary control`
- Suggested problem statement:
  - `agent-browser` can stream output and preserve transcripts, but it does not yet give users explicit in-flight steering semantics for long-running tool-heavy turns. Extra messages currently do not map cleanly to choices like steer at the next tool boundary, queue a follow-up turn, coalesce a backlog, or preserve both an immediate steer and a later follow-up. The UI also lacks a single progress-draft surface that stays visible while the agent reads, plans, calls tools, or waits for approval. Users are left guessing whether their interruption replaced the run, appended to it, or disappeared into the session history.`
- One-shot instruction for an LLM:
  - Implement queued steering controls for `agent-browser` so a running session supports explicit per-session modes for steer-now-at-turn-boundary, follow-up-after-completion, coalesced backlog, and steer-plus-backlog; add debounce, queue-cap, and overflow policy handling, persist that mode with the session, and render one visible progress-draft surface that updates during real work and resolves into the final answer without spawning redundant interim assistant messages.
