# Agent Harness Glossary

## Repo Overview

- `agent_harness` is a repository of agent-harness UX proofs of concept, bundled skills, and reference product design work.
- `agent-browser/` is the live React + Vite prototype for the agent-first browser workspace shell.
- `reference_impl/` contains design references, architecture notes, and feature explorations. Treat it as conceptual guidance, not the live implementation.
- `skills/` is the canonical source for bundled skills in this repository.

## Canonical Product Terms

### Workspace

A named, isolated working context. In `agent-browser`, each workspace owns its own browser tabs, Files surface, agent chat sessions, terminal sessions, and workspace-scoped view state.

Examples: `Research`, `Build`.

### Workspace Switcher

The overlay used to swap the active workspace. It is the control surface for switching, creating, and renaming workspaces.

### Workspace Tree

The sidebar explorer for the active workspace. It shows the active workspace root plus its Browser, Terminal, Agent, and Files categories. It should not collapse multiple top-level workspaces into a single shared pane.

### Browser Tab

A page node inside a workspace's Browser category. Opening one shows the page overlay in the content area.

### Page Overlay

The simulated browser surface shown in the main content area when a browser tab is active. It is not a workspace and it is not the chat panel.

### Chat Panel

The default main-content assistant surface for the active workspace.

### Terminal Mode

The chat panel's terminal view, backed by `just-bash`. Terminal sessions are scoped to the active workspace, and each one runs against its own isolated in-memory filesystem.

### Workspace Files

Capability files attached to a workspace, such as `AGENTS.md`, skill files, plugin manifests, and hook files, plus virtual filesystem nodes exposed by workspace terminal sessions.

### Virtual Filesystem

The workspace-scoped filesystem representation shown under Files. It includes persisted workspace capability files plus the filesystem trees emitted by that workspace's terminal sessions.

### Research / Build

The seeded default workspaces in the prototype. Treat them as distinct workspaces the user can switch between, not panes rendered simultaneously.

### Worktree

Unless stated otherwise, we ARENT referring to git worktrees; we are referring to the tree view of context rendered in the workspace.

### Browser-Runnable ONNX Models

Hugging Face models intended to run in-browser for local inference, typically through Transformers.js-based flows in `agent-browser`.

### Local Models

Browser-runnable ONNX models that the user discovers, installs, and runs locally inside the browser workspace experience. Treat them as local inference assets rather than hosted API models.

### Active Document Surface

A first-class content surface that opens directly in the main area and is meant for active work. Browser tabs, text-like files, notes, and structured docs should be framed this way.

### Media Surface

A viewer or playback surface for assets such as audio, PDFs, DOCX files, images, and video. These are not the default text-editing surfaces; they open for viewing or playback instead.

### Codespaces Browse URL

The forwarded URL pattern used for browser navigation and redirect URIs inside GitHub Codespaces:

`https://${CODESPACE_NAME}-${PORT}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`

Do not rebuild this formula ad hoc in conversation or code when the repo skill is available. Run the bundled helper instead:

```bash
skills/agent-harness-context/scripts/codespaces-uri.sh 5173
skills/agent-harness-context/scripts/codespaces-uri.sh 5173 /auth/callback
skills/agent-harness-context/scripts/codespaces-uri.sh --public --check 5173 /auth/callback
```

The script queries the necessary environment variables, constructs the URL, and can optionally make the port public and validate the base URL.

Use `localhost` only for tools running inside the container, such as `curl`, Playwright, or health checks.

## Practical Implications

- Switching workspaces should swap context, not render multiple workspaces into one combined pane.
- Opening a tab or file from another workspace may auto-switch to that workspace.
- When switching back, preserve workspace-scoped state instead of leaking view state across workspaces.
- Describe local model setup as an in-browser installation and activation flow for browser-runnable ONNX models.
- Describe terminal filesystems as isolated workspace-scoped virtual filesystems, not as the user's host disk.
- When describing content surfaces, distinguish active or editable document surfaces from viewer-only or playback-only media surfaces.
- For browser debugging or auth callback setup in Codespaces, generate the URL by running `skills/agent-harness-context/scripts/codespaces-uri.sh`, not by reconstructing environment-variable logic from memory.
- If docs or tests still describe all workspaces rendering together, treat that as stale language and update it.

## Source Map

- `AGENTS.md`: repo operating rules, Codespaces browser and redirect URI guidance
- `agent-browser/docs/features.md`: live prototype feature language and screenshot guide
- `reference_impl/workspace-architecture.md`: conceptual workspace model and terminology
- `agent-browser/src/App.tsx`: current implementation of workspace, page overlay, chat, and terminal behaviors
- `agent-browser/tests/app.spec.ts` and `agent-browser/src/App.test.tsx`: executable expectations for current UI behavior
- `skills/agent-harness-context/scripts/codespaces-uri.sh`: deterministic helper for Codespaces browse URLs and redirect URIs

## Conflict Resolution

- Prefer direct user corrections over stale prose.
- Prefer live implementation and tests over older exploratory docs when the prototype behavior has already changed.
- If the task is about git worktrees, say so explicitly and stop using workspace terminology for that part of the discussion.