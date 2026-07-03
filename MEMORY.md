# MEMORY.md

<!--
Durable, cross-session memory for agents working in this repository. Each entry
is a non-obvious fact or correction that future sessions should know without
re-deriving it. Apply delta updates (add/refine single entries), never full
rewrites. Deprecate stale entries with a `[DEPRECATED]` marker and a reason
rather than deleting silently. Mark entries `[PERSISTED]` once saved to an
agent's long-term memory.
-->

## Terminology

- **"Worktree" means the workspace tree view, not a git worktree** — unless the
  task is explicitly about git worktrees. Canonical source:
  `skills/agent-harness-context/references/glossary.md`.
- **Workspaces are isolated contexts.** Each owns its own browser tabs, Files
  surface, chat sessions, terminal sessions, and view state. Switching
  workspaces swaps context; it must not render multiple workspaces into one
  combined pane.
- **"Local Models" run in-browser.** They are browser-runnable ONNX models
  executed via Transformers.js inside `agent-browser` ("Codi"), not hosted API
  models. A separate path connects to a user-run OpenAI-compatible endpoint
  (LM Studio / Ollama) via the Local Model Connector extension.

## Repository conventions

- **Canonical skills live in `skills/<name>/`;** `.claude/skills/<name>` and
  `.agents/skills/<name>` are symlinks. Edit under `skills/`, keep both links
  in sync, and do not hand-edit copied skill trees.
- **`reference_impl/` is conceptual guidance, not the live implementation.**
  On conflict, prefer live code and tests (`agent-browser/src`, package tests)
  over exploratory docs.
- **Validation is scoped per changed path;** `verify:agent-browser` is the full
  gate reserved for cross-project, dependency/CI/release, or explicitly
  requested runs (see `AGENTS.md` and `STEERING.md` rule 3).

## Environment

- **In Codespaces, use the forwarded Codespaces URL** for browser navigation
  and redirect URIs; use `localhost` only for in-container tools (curl,
  Playwright, health checks). Generate the URL with
  `skills/agent-harness-context/scripts/codespaces-uri.sh`, never by hand.
