# TK-15 Projects Entry Point

## Linear Context

TK-15 asks Agent Browser to support "Projects" as the main page and entry point, with new projects opening the same existing session view users already know from ChatGPT/Claude-style project flows.

## Architecture Decision

Projects are a user-facing layer over the existing workspace tree. The app already has durable workspace-scoped sessions, files, browser pages, mounted terminal filesystems, and dashboard view state. Creating a separate project tree would duplicate this state and risk context leaks, so the implementation keeps `TreeNode.type === 'workspace'` as the persistence model and adds `services/projects.ts` as the presentation and creation adapter.

## Behavior

- The primary navigation item now says Projects.
- The switcher dialog now says Project switcher and summarizes each project with session count, browser page count, memory, and file count.
- Ctrl+Alt+N creates `Project N`, backed by the same dashboard and mounted `Session 1` contract as workspace creation.
- Rename and switch controls use project language while preserving workspace IDs and storage keys for compatibility.
- Existing workspace files, page overlays, and sessions continue to scope by workspace ID.

## TDD Coverage

- `agent-browser/src/services/projects.test.ts` defines the adapter contract for project summaries, naming, color choice, file counts, and session-backed creation.
- `agent-browser/src/App.integration.test.tsx` covers the visible Projects entrypoint, the project switcher search, `Project 3` creation, and the dashboard/session widget that opens for a new project.
- Existing smoke coverage was updated to open Projects before creating session widgets.

## Verification Notes

This run hit the recurring Windows sandbox startup blocker for Vitest/esbuild: `Cannot read directory "../../../../..": Access is denied.` Source-level `node --experimental-strip-types --check` checks are used as a fallback where Vitest cannot start.
