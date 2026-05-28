# Summary Diff For Linear Feature Generation

Updated: 2026-05-28
Baseline: `.features/Summary.md` refreshed from the 2026-05-26 and 2026-05-27 corpora.
Diff type: additive updates after OpenClaw, Kimi AI, and OpenAI Symphony refreshes

## Net new normalized features

### Added: Queued steering with visible progress drafts
- Why now: the refreshed OpenClaw corpus makes human steering semantics much more explicit than the older notes captured. The product now has first-class queue modes, turn-boundary steering behavior, and a single visible progress draft for long-running work.
- Research delta:
  - OpenClaw exposes named queue modes like `steer`, `followup`, `collect`, and `steer-backlog`, instead of forcing every extra message through one ambiguous interruption path
  - steering happens at explicit tool boundaries, while follow-up and collect modes preserve the current run and drain later with debounce and overflow policies
  - progress drafts create one visible work-in-progress message that updates while the agent reads, plans, calls tools, or waits for approval, instead of flooding the thread with temporary chatter
  - the same harness links queued steering to durable session state and background-task records, so follow-up behavior is part of the runtime contract rather than just UI sugar

### Added: Artifact-to-skill conversion from finished work
- Why now: the Kimi AI refresh shows a first-party product flow where strong documents are no longer just references or memory sources. They can be turned into reusable skills and then re-applied in future runs.
- Research delta:
  - the current K2.6 page exposes a `Document to skills` flow from the main product surface rather than burying it in niche docs
  - the help center says generated skills can bundle methodology, standards, scripts, tools, and references, which is materially richer than a saved prompt
  - Kimi explicitly positions these artifact-derived skills as reusable across Agent, Kimi Code, and Kimi Claw contexts
  - Kimi also ties the feature to Agent Swarm, positioning captured skills as a way to improve consistency across large multi-agent runs

### Added: Explicit writable-root policies that preserve the active issue workspace
- Why now: the OpenAI Symphony refresh surfaced a first-party hardening pattern for issue-scoped workspaces. Explicit `workspaceWrite` roots should extend the active issue workspace, not replace it.
- Research delta:
  - PR `#58` says Symphony should keep the current issue workspace writable even when operators or workflows pass explicit `workspaceWrite` roots for linked-worktree `.git` metadata or other extra writable paths
  - the PR summary says the runtime prepends the current issue workspace to explicit `workspaceWrite` policies and leaves non-`workspaceWrite` policies unchanged
  - the public spec already treats the per-issue workspace path as a safety invariant for `cwd`, which makes this an important contract-composition fix rather than a convenience tweak
  - the Elixir reference validates real local and SSH worker runs inside per-issue workspaces, so preserving that root in the effective writable set matters for real transport-backed orchestration

## Expanded normalized features

### Expanded: Parallel agent orchestration
- Why now: Kimi AI is no longer limited to a single orchestrator spawning homogeneous specialists. `Claw Groups` expands the pattern into a shared workspace for mixed humans and agents with different models, tools, and contexts.
- Research delta:
  - the K2.6 product page says users can bring agents with different tools, contexts, and models into one shared space
  - the coordinator handles task assignment and dependency tracking rather than just sub-agent spawning
  - the Kimi Claw help center now includes `Claw Group Chat overview` in the navigation, showing that this is becoming a productized surface rather than a research aside

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: OpenClaw's current product surface goes beyond installable skills and into skill-generation and plugin-authoring infrastructure.
- Research delta:
  - OpenClaw now documents layered skill precedence across workspace, shared, managed, bundled, and plugin-shipped roots
  - the optional Skill Workshop can synthesize workspace skills from observed reusable procedures
  - the stable `2026.5.18` release added typed plugin helpers plus `openclaw plugins build`, `validate`, and `init`

### Expanded: Multi-surface continuity
- Why now: Kimi's coding surface is now clearly part of the harness family rather than a separate tool line.
- Research delta:
  - Kimi Code now spans CLI, VS Code, and third-party coding-agent usage with shared membership-backed access
  - official clients use OAuth `/login` and extension-side login flows, while third-party tools can reuse Kimi Code through API-key access
  - the docs explicitly call out compatibility with adjacent coding harnesses such as Claude Code

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: OpenClaw now exposes a stronger operator plane than the previous lightweight corpus captured.
- Research delta:
  - the browser dashboard is explicitly an admin surface for chat, config, sessions, nodes, and exec approvals
  - detached ACP, subagent, cron, and CLI work now lands in durable task records with lifecycle state and requester linkage
  - the stable `2026.5.18` release highlights faster settings, cleaner chat and session controls, and responsive logs as part of the main product

## Linear-ready feature payloads

### Proposed Linear feature: Add queued steering with progress drafts and turn-boundary control
- Linear issue:
  - Pending external publication in this session because callable Linear issue tools are not available in this environment; the feature brief below is the canonical issue payload
- Linear issue title:
  - `Add queued steering with progress drafts and turn-boundary control`
- Suggested problem statement:
  - `agent-browser` can stream output and preserve transcripts, but it does not yet give users explicit in-flight steering semantics for long-running tool-heavy turns. Extra messages currently do not map cleanly to choices like steer at the next tool boundary, queue a follow-up turn, coalesce a backlog, or preserve both an immediate steer and a later follow-up. The UI also lacks a single progress-draft surface that stays visible while the agent reads, plans, calls tools, or waits for approval. Users are left guessing whether their interruption replaced the run, appended to it, or disappeared into the session history.`
- One-shot instruction for an LLM:
  - Implement queued steering controls for `agent-browser` so a running session supports explicit per-session modes for steer-now-at-turn-boundary, follow-up-after-completion, coalesced backlog, and steer-plus-backlog; add debounce, queue-cap, and overflow policy handling, persist that mode with the session, and render one visible progress-draft surface that updates during real work and resolves into the final answer without spawning redundant interim assistant messages.

### Proposed Linear feature: Add artifact-to-skill generation from documents and examples
- Linear issue:
  - Pending external publication in this session because callable Linear issue tools are not available in this environment; the feature brief below is the canonical issue payload
- Linear issue title:
  - `Add artifact-to-skill generation from documents and examples`
- Suggested problem statement:
  - `agent-browser` already supports skills, prompts, and repo instructions, but it still assumes users or developers will author those workflow packages manually. In practice, teams already have high-signal artifacts such as PRDs, reports, templates, playbooks, and gold-standard deliverables that encode the workflow they want the harness to reuse. Today there is no first-class path to ingest those artifacts, extract the stable methodology and output structure, and turn them into a reviewable reusable skill. That keeps valuable process knowledge trapped in static files and makes skill authoring slower, less accessible, and less likely to stay aligned with the real artifacts teams already trust.`
- One-shot instruction for an LLM:
  - Implement artifact-to-skill generation for `agent-browser`: add a flow that accepts a strong example document or artifact set, extracts reusable workflow instructions, output structure, and referenced assets, converts that into a first-class skill package with editable metadata and generated instructions, shows a review screen before activation, stores provenance back to the source artifact, and makes the resulting skill available for future task routing across chat, browser, coding, and background-run surfaces.

### Proposed Linear feature: Add explicit writable-root policies that preserve the active issue workspace
- Linear issue title:
  - `Add explicit writable-root policies that preserve the active issue workspace`
- Suggested problem statement:
  - `agent-browser` already supports sandbox and worktree-oriented execution, but explicit writable-root configuration is fragile. When users, workflows, or runtime helpers add extra writable roots such as linked-worktree `.git` metadata, cache directories, or other task-adjacent paths, it is too easy for that explicit list to replace the current issue or worktree root instead of extending it. That breaks ordinary editing in subtle ways and forces operators to over-broaden filesystem permissions just to keep the active task writable. The harness needs a clear composition rule where the current task workspace remains writable by default and extra roots are additive, inspectable, and test-covered.`

- One-shot instruction for an LLM:
  - Implement explicit writable-root policy composition for `agent-browser`: when a run, workflow, or integration supplies extra writable roots, automatically retain the current issue or worktree root in the effective writable set, keep non-filesystem sandbox policies unchanged, surface the final writable-root list in the run UI or logs, support extra roots such as linked-worktree `.git` metadata and cache directories without broadening to the whole repo, and cover the contract with config, runtime, and app-server regression tests.
