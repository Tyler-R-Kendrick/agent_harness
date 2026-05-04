# Summary Diff For Linear Feature Generation

Updated: 2026-05-04
Baseline: `.features/Summary.md` updated from the 2026-05-03 twenty-one-harness corpus.
Diff type: additive update after Gemini CLI research

## Net new normalized features

### Added: Chaptered session structure and automatic context compression
- Why now: Gemini CLI is treating context bloat and long-session readability as first-class harness problems instead of leaving them to the underlying model.
- Research delta:
  - the April 2026 Gemini CLI v0.38.0 release notes add `Chapters Narrative Flow`
  - the same release adds a dedicated `Context Compression Service`
  - the May 2026 v0.39.0 notes also mention a decoupled `ContextManager`, which shows continuing investment in session shaping and context-budget management

### Expanded: Persistent memory plus project instructions
- Why now: Gemini CLI is turning memory capture into an explicit review loop instead of silent transcript retention.
- Research delta:
  - Auto Memory extracts candidate memories and reusable skills from prior conversations
  - new memories land in a user-visible review inbox
  - layered `GEMINI.md` files with `@import` keep project instructions versioned and composable

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Gemini CLI extensions package more of the harness surface than a normal command plugin.
- Research delta:
  - extensions can carry commands, prompts, tools, hooks, themes, subagents, policy, MCP configuration, and `GEMINI.md` context
  - the package format supports project and shared installation patterns
  - governance and delegation can ship inside the same reusable unit as prompts and tools

### Expanded: Parallel agent orchestration
- Why now: Gemini CLI now spans both local specialization and remote delegation instead of treating subagents as an in-process-only idea.
- Research delta:
  - Gemini CLI documents first-class subagents
  - Remote Agents adds agent-to-agent delegation across a defined protocol boundary
  - git worktree guidance makes session isolation part of the orchestration story

### Expanded: Embeddable agent runtimes and protocol surfaces
- Why now: Gemini CLI is making automation-friendly output part of the product surface instead of forcing consumers to scrape TTY text.
- Research delta:
  - headless mode supports non-interactive automation
  - JSON and streaming output modes make the harness easier to embed in scripts, CI, and control planes
  - model routing and local router support reinforce the idea that the runtime can be composed into mixed deployment topologies

### Added: Add chaptered sessions and automatic context compression for browser-agent runs
- Why now: `agent-browser` has long-running sessions, browser traces, and transcript-heavy workflows, but it still lacks an explicit mechanism for grouping, compressing, and carrying forward long-task context the way Gemini CLI now does.
- Linear issue title:
  - `Add chaptered sessions and automatic context compression for browser-agent runs`
- Suggested problem statement:
  - `agent-browser` keeps long browser-agent work in raw transcript form, which makes extended runs harder to navigate, more expensive to continue, and more likely to lose coherence as browser evidence, plans, and retries accumulate.
- One-shot instruction for an LLM:
  - Implement chaptered session structure and automatic context compression for `agent-browser` so long runs are grouped into navigable sections, summaries are inspectable and linked back to the full trace, and the harness can carry forward compressed context without hiding critical browser evidence or validation results.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add chaptered sessions and automatic context compression for browser-agent runs`
