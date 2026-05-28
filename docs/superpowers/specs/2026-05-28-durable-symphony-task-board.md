# Durable Symphony Task Board Spec

## Linear Issue

Working issue: `TK-64`

Linear status: the connected Linear workspace does not expose `TK-64`; searching by identifier returned no issue and updating `TK-64` returned `Entity not found: Issue`. This spec keeps the requested implementation scope local and recoverable.

## Problem

The Symphony board is the correct first-class UI for multi-agent task management, but its durable state is currently stored as a single `agent-browser.multitask-subagent-state` record. That makes the board durable across refreshes for one workspace, but not durable across multiple workspaces: starting Symphony work in one workspace can overwrite another workspace's board.

## Goal

Make the existing Symphony project board a durable multi-agent task board per workspace without creating a new extension page or parallel board UI.

## Requirements

- Store Symphony task-board state in a workspace-keyed durable record.
- Preserve the existing `agent-browser.multitask-subagent-state` key as a compatibility mirror for the active workspace.
- Hydrate the active Symphony board from the workspace-keyed store first, then from the legacy key when it matches the active workspace.
- Keep all existing project/task/create/select/start/stop/retry/dispose/review actions flowing through the existing Symphony board.
- Add tests that prove one workspace's board survives when another workspace starts a new Symphony task.
- Keep `visual:agent-browser` as the visual proof path and `verify:agent-browser` as the full gate.

## Non-Goals

- Do not reintroduce the legacy Symphony extension feature page.
- Do not replace the existing `SymphonyWorkspaceApp` board.
- Do not add server-side Linear sync in this slice.

## One-Shot Prompt

Implement Linear issue `TK-64` in `agent-browser`: make the existing Symphony board a durable multi-agent task board per workspace. Use TDD. First add failing tests for a workspace-keyed `multitaskSubagentStateByWorkspace` storage key, a validator for `Record<string, MultitaskSubagentState>`, and an App smoke case proving a seeded `ws-research` board remains stored when `ws-build` starts a new Symphony task. Then implement the key in `agent-browser/src/services/sessionState.ts`, the validator in `agent-browser/src/services/multitaskSubagents.ts`, and update `agent-browser/src/App.tsx` so all Symphony board mutations persist to the active workspace entry while mirroring the active state to the legacy key. Keep the rendering in `agent-browser/src/features/symphony/SymphonyOrchestrationPanel.tsx`. Validate with focused Vitest coverage, `npm.cmd run visual:agent-browser`, and `npm.cmd run verify:agent-browser`.
