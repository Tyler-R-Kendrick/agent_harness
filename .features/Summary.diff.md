# Summary Diff For Linear Feature Generation

Updated: 2026-04-30
Baseline: `.features/Summary.md` updated from the 2026-04-30 thirteen-harness corpus.
Diff type: additive update after Pi research

## Net new normalized features

### Added: Expose browser agents as embeddable runtimes
- Why now: Pi treats the harness as a reusable runtime, not just a human-facing CLI, with interactive, print/JSON, JSON-RPC, and SDK modes all documented from the main product surface.
- Research delta:
  - the Pi README says the coding harness runs in interactive, print or JSON, RPC, and SDK modes
  - the RPC docs define a real protocol with command IDs, streaming events, and strict JSONL framing over stdin/stdout
  - the SDK path is explicit enough that the docs recommend in-process `AgentSession` usage for Node.js instead of always spawning a subprocess

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: Pi pushes packaging farther than most harnesses by letting prompt templates, skills, extensions, and themes travel together as installable Pi Packages from npm, git, GitHub URLs, or local paths.
- Research delta:
  - package docs show global, project, and one-run ephemeral install flows
  - project package settings can be shared with a team and auto-install on startup
  - extensions can alter not just tools but large parts of the terminal UI and command surface

### Expanded: Persistent memory plus project instructions
- Why now: Pi sharpens the repo-instruction pattern by treating `AGENTS.md` or `CLAUDE.md` loading and system-prompt layering as a documented contract, while also adding a clean-room escape hatch.
- Research delta:
  - Pi loads global, parent-directory, and current-directory context files automatically
  - `.pi/SYSTEM.md` and `APPEND_SYSTEM.md` let projects replace or append to the system prompt
  - recent releases added `--no-context-files` for deliberately bypassing inherited guidance

### Expanded: Shareable sessions and debug handoff
- Why now: Pi combines private gist-based HTML sharing with a public workflow for publishing real OSS coding sessions to Hugging Face.
- Research delta:
  - `/export` writes HTML artifacts and `/share` publishes a private gist-backed share link
  - the README explicitly asks users to publish real open-source sessions to improve models, tools, prompts, and evals
  - recent release notes include export-safety fixes, showing the artifact path is actively maintained

### Added: Ship a typed SDK plus JSON-RPC surface for `agent-browser`
- Why now: Browser agents are still mostly trapped inside their own first-party UI, which makes it harder to reuse the same runtime in editors, dashboards, and orchestrators.
- Linear issue title:
  - `Expose agent-browser via SDK and JSON-RPC`
- Suggested problem statement:
  - `agent-browser` is still too tied to its own UI and process model, which blocks other product surfaces from embedding the same session, tool, and artifact lifecycle directly.
- One-shot instruction for an LLM:
  - Design and implement a reusable runtime layer for `agent-browser` with a typed in-process SDK plus a documented JSON-RPC or JSONL streaming protocol for subprocess clients, including request correlation, event streaming, session persistence hooks, and examples for embedding the harness in another app.

### Added: Version installable browser-agent workflow packs
- Why now: Pi treats installable packages as the main way to transport prompts, skills, themes, and extensions between projects and teams.
- Linear issue title:
  - `Create installable workflow packs for agent-browser`
- Suggested problem statement:
  - Repeatable browser-agent workflows still depend too much on local prompts and ad hoc scripts, which makes team reuse and governed rollout difficult.
- One-shot instruction for an LLM:
  - Build an installable workflow-pack format for `agent-browser` that can bundle prompts, skills, tool permissions, UI affordances, and optional scripts, support local and remote package sources, allow project-scoped auto-install, and expose clear enable-disable controls for teams.

### Added: Add branch-aware compaction and session-tree navigation
- Why now: Pi treats long-running sessions as tree-structured state with explicit compaction and revisitable history instead of a flat transcript that only grows until it breaks.
- Linear issue title:
  - `Add session trees and branch-aware compaction`
- Suggested problem statement:
  - Long browser-agent runs become hard to steer or resume once the transcript grows, and alternative branches are difficult to compare without forking external artifacts by hand.
- One-shot instruction for an LLM:
  - Implement tree-structured session history for `agent-browser` with labeled branch points, resumable forks, lossy compaction with preserved raw history, and a UI for revisiting or continuing from earlier checkpoints without losing later branches.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Expose agent-browser via SDK and JSON-RPC`
2. `Create installable workflow packs for agent-browser`
3. `Add session trees and branch-aware compaction`
