---
name: agent-harness-context
description: Project context and canonical terminology for the agent_harness repository, especially the agent-browser product model. Use this whenever the user asks you to work in this repo, mentions agent-browser, workspaces, Research, Build, workspace switching, worktrees, page overlays, chat panel, terminal mode, workspace files, virtual filesystems, local model installation or browser-runnable ONNX models, active document surfaces, or Codespaces browser debugging. This skill exists to prevent terminology drift and incorrect architectural assumptions in this repository.
---

# Agent Harness Context

Use this skill to align on repository structure and product language before changing code, docs, tests, screenshots, or explanations in this repository.

## Workflow

1. Read `references/glossary.md` whenever the task touches product terminology, workspace semantics, repo conventions, or browser-debugging setup.
2. Use the repository's canonical language in code, docs, tests, and user-facing copy.
3. If existing prose conflicts with a direct user correction, prefer the user's correction and update the stale docs or tests.
4. Describe top-level product contexts as workspaces, not panes, unless the task is explicitly about split-pane layout.
5. For Codespaces browser URLs or redirect URIs, run `scripts/codespaces-uri.sh` instead of rebuilding the URL formula inline.
6. Prefer deterministic repo scripts over generated one-off CLI commands. Check `package.json`, `scripts/`, and skill-local `scripts/` before inventing a dynamic command, and promote repeated command sequences into scripts.
7. Use the forwarded Codespaces URL rather than `localhost` for browser round-trips, redirect URIs, and embedded browser navigation.

## Core Rules

- `Research` and `Build` are separate workspaces. They are not sibling panes inside one workspace.
- A workspace is an isolated context with its own browser tabs, files surface, agent sessions, terminal sessions, and workspace-scoped view state.
- `worktree` is a git term. Do not use it for the product UI unless the task is actually about git worktrees.
- `page overlay`, `chat panel`, `terminal mode`, `workspace switcher`, and `workspace files` have specific meanings defined in the glossary.
- For repeated testing, browser validation, setup, or reporting flows, use checked-in commands first. If a useful workflow only exists as an ad hoc shell or Playwright sequence, add a deterministic script and document the command.
- When the task needs a Codespaces browse URL or redirect URI, prefer `skills/agent-harness-context/scripts/codespaces-uri.sh` over manual environment-variable composition.
- User-visible changes in `agent-browser/` should keep Playwright tests and screenshots in sync.

## Current Capability Snapshot

Use this as the default feature framing unless the user corrects it.

- Local models are installed and used in-browser. The Settings flow is for discovering browser-runnable ONNX models and activating them for local inference.
- Terminal mode is an in-browser `just-bash` shell. Each terminal session runs against an isolated in-memory filesystem rather than the host machine.
- Each workspace has its own virtual filesystem surface. Persisted workspace files and terminal-session filesystem nodes are both exposed under that workspace's Files category.
- Users can swap between open workspaces and create new ones from the workspace switcher, workspace pills, or keyboard shortcuts. Each workspace keeps its own tabs, files, chats, terminals, and view state.
- Browser tabs, text-like files, notes, and structured docs should be described as active document surfaces. Media assets such as audio, PDFs, DOCX files, images, and video are viewer or playback surfaces rather than text-editing surfaces.

## Bundled Script

### Agent Browser Verification

For `agent-browser` changes, prefer these repo-level commands over generated CLI sequences:

```bash
npm run verify:agent-browser
npm run visual:agent-browser
```

`npm run verify:agent-browser` is the canonical full check. It runs lint, coverage tests, build, audit, and the deterministic visual smoke test.

`npm run visual:agent-browser` starts an isolated Vite server on a free localhost port, verifies the Agent Browser shell with Playwright, and writes `output/playwright/agent-browser-visual-smoke.png`.

### `scripts/codespaces-uri.sh`

Run this script whenever the task needs the forwarded Codespaces base URL or a full redirect URI.

Examples:

```bash
skills/agent-harness-context/scripts/codespaces-uri.sh 5174
skills/agent-harness-context/scripts/codespaces-uri.sh 5174 /auth/callback
skills/agent-harness-context/scripts/codespaces-uri.sh --public --check 5174 /auth/callback
```

Behavior:

- Reads the required Codespaces environment variables itself.
- Builds the forwarded HTTPS URL.
- Optionally makes the port public with `--public`.
- Optionally validates the forwarded base URL with `--check`.
- Prints the final URL on stdout so callers can use command substitution.

## When This Skill Matters Most

- Fixing or designing workspace switching, tree rendering, page overlays, or per-workspace state isolation
- Describing local-model installation, workspace-scoped terminal or virtual-filesystem behavior, or active-document versus media surfaces
- Updating docs, tests, screenshots, or explanations that describe the agent-browser UI
- Interpreting product language in the repo's design docs versus the live prototype
- Handling Codespaces browsing, OAuth redirect URIs, or browser debugging in this repo

## Sources To Trust

- `AGENTS.md` for repo conventions and Codespaces browsing rules
- `agent-browser/docs/features.md` for current feature descriptions, unless superseded by a newer user correction
- `reference_impl/workspace-architecture.md` for the intended workspace mental model
- `agent-browser/src/App.tsx` and `agent-browser/tests/` for the live prototype behavior
- `skills/agent-harness-context/scripts/codespaces-uri.sh` for generating Codespaces browser URLs and redirect URIs
