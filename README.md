# Agent Harness

Agent Harness is a monorepo for experimenting with agent UX, workspace flows, and reusable agent-facing libraries. The main runnable app in this checkout is `agent-browser`, a React/Vite workspace for testing browser-oriented agent interactions.

## Who This Repo Is For

- Contributors working on the `agent-browser` UI and its supporting libraries.
- Maintainers evolving the agent runtime, MCP integrations, and bundled skills.
- Integrators reusing checked-in skills from `skills/` in other repositories.

## Repository Map

- `agent-browser/` - the main app workspace and its deeper product docs.
- `lib/` - reusable TypeScript libraries such as `webmcp`, `agent-browser-mcp`, and `logact`.
- `skills/` - bundled skills that are checked into the repo and symlinked into compatibility locations.
- `reference_impl/` - research, feature specs, and architecture notes for longer-term directions.
- `docs/` - implementation plans and supporting design notes.

## Quickstart

### Prerequisites

- Node.js 20.x and npm.
- A shell environment that can run the workspace scripts from the repo root.

### Install Dependencies

```bash
npm install
```

### Start The Main App

From the repo root:

```bash
npm run dev:agent-browser
```

This starts the `agent-browser` Vite dev server on port `5173`.

If you open the repository in VS Code, `.vscode/tasks.json` is also configured to auto-start that dev server on folder open.

### Verify Before Handing Off Changes

From the repo root:

```bash
npm run verify:agent-browser
```

That verification script runs:

- TypeScript linting for `agent-browser`
- Vitest coverage for `agent-browser`
- The production build
- `npm audit --audit-level=moderate`
- The Playwright visual smoke test via `npm run visual:agent-browser`

If you only need the screenshot-generating smoke check, run:

```bash
npm run visual:agent-browser
```

The visual smoke script writes its screenshot to `output/playwright/agent-browser-visual-smoke.png`.

## Codespaces Note

When working in GitHub Codespaces, use the forwarded Codespaces URL for browser navigation. Keep `http://localhost:<port>` for tools running inside the container, such as `curl`, Playwright, or local health checks.

To print the forwarded preview URL for port `5173`:

```bash
./skills/agent-harness-context/scripts/codespaces-uri.sh 5173
```

## Where To Go Next

- See [`agent-browser/README.md`](agent-browser/README.md) for app-specific commands and Codespaces preview behavior.
- See [`agent-browser/docs/features.md`](agent-browser/docs/features.md) for the current product surface.
- See [`reference_impl/README.md`](reference_impl/README.md) for research and reference designs.
- See [`AGENTS.md`](AGENTS.md) for repository-specific implementation, testing, and verification expectations.

## Bundled Skills

Bundled skills live canonically in `skills/<skill-name>/`. Compatibility symlinks for agent tooling should point from `.agents/skills/<skill-name>` and `.claude/skills/<skill-name>` back to that canonical location.

To expose one of these bundled skills from another repository, symlink the entire skill directory so nested assets such as `agents/`, `scripts/`, and reference files stay intact.

Example:

```bash
mkdir -p .agents/skills
ln -snf /path/to/agent-harness/skills/frontend-design .agents/skills/frontend-design
mkdir -p .claude/skills
ln -snf /path/to/agent-harness/skills/frontend-design .claude/skills/frontend-design
```

Some skills also package nested agent instructions under their own directories. Those are installed automatically when you copy or symlink the parent skill directory.

## Copilot Setup

Copilot setup still registers the Superpowers marketplace/plugin for Copilot sessions, but the bundled skills themselves are checked into this repository instead of being installed during setup.
