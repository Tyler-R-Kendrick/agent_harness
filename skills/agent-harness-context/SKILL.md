---
name: agent-harness-context
description: Project context and canonical terminology for the agent_harness repository, especially the agent-browser product model. Use this whenever the user asks you to work in this repo, mentions agent-browser, workspaces, Research, Build, workspace switching, worktrees, page overlays, chat panel, terminal mode, workspace files, browser-runnable ONNX models, or Codespaces browser debugging. This skill exists to prevent terminology drift and incorrect architectural assumptions in this repository.
---

# Agent Harness Context

Use this skill to align on repository structure and product language before changing code, docs, tests, screenshots, or explanations in this repository.

## Workflow

1. Read `references/glossary.md` whenever the task touches product terminology, workspace semantics, repo conventions, or browser-debugging setup.
2. Use the repository's canonical language in code, docs, tests, and user-facing copy.
3. If existing prose conflicts with a direct user correction, prefer the user's correction and update the stale docs or tests.
4. Describe top-level product contexts as workspaces, not panes, unless the task is explicitly about split-pane layout.
5. For Codespaces browser URLs or redirect URIs, run `scripts/codespaces-uri.sh` instead of rebuilding the URL formula inline.
6. Use the forwarded Codespaces URL rather than `localhost` for browser round-trips, redirect URIs, and embedded browser navigation.

## Core Rules

- `Research` and `Build` are separate workspaces. They are not sibling panes inside one workspace.
- A workspace is an isolated context with its own browser tabs, files surface, agent sessions, terminal sessions, and workspace-scoped view state.
- `worktree` is a git term. Do not use it for the product UI unless the task is actually about git worktrees.
- `page overlay`, `chat panel`, `terminal mode`, `workspace switcher`, and `workspace files` have specific meanings defined in the glossary.
- When the task needs a Codespaces browse URL or redirect URI, prefer `skills/agent-harness-context/scripts/codespaces-uri.sh` over manual environment-variable composition.
- User-visible changes in `agent-browser/` should keep Playwright tests and screenshots in sync.

## Bundled Script

### `scripts/codespaces-uri.sh`

Run this script whenever the task needs the forwarded Codespaces base URL or a full redirect URI.

Examples:

```bash
skills/agent-harness-context/scripts/codespaces-uri.sh 5173
skills/agent-harness-context/scripts/codespaces-uri.sh 5173 /auth/callback
skills/agent-harness-context/scripts/codespaces-uri.sh --public --check 5173 /auth/callback
```

Behavior:

- Reads the required Codespaces environment variables itself.
- Builds the forwarded HTTPS URL.
- Optionally makes the port public with `--public`.
- Optionally validates the forwarded base URL with `--check`.
- Prints the final URL on stdout so callers can use command substitution.

## When This Skill Matters Most

- Fixing or designing workspace switching, tree rendering, page overlays, or per-workspace state isolation
- Updating docs, tests, screenshots, or explanations that describe the agent-browser UI
- Interpreting product language in the repo's design docs versus the live prototype
- Handling Codespaces browsing, OAuth redirect URIs, or browser debugging in this repo

## Sources To Trust

- `AGENTS.md` for repo conventions and Codespaces browsing rules
- `agent-browser/docs/features.md` for current feature descriptions, unless superseded by a newer user correction
- `reference_impl/workspace-architecture.md` for the intended workspace mental model
- `agent-browser/src/App.tsx` and `agent-browser/tests/` for the live prototype behavior
- `skills/agent-harness-context/scripts/codespaces-uri.sh` for generating Codespaces browser URLs and redirect URIs