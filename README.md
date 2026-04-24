# Agent Harness

Agent Harness is a monorepo for experimenting with agent-oriented desktop and browser UX, with `agent-browser` as the primary runnable app and `skills/` as the checked-in bundled skill library.

This repository is most useful for contributors working on the `agent-browser` prototype, maintainers evolving shared agent skills, and readers inspecting reference feature explorations under `reference_impl/`.

## Repository layout

- `agent-browser/`: React + Vite prototype for the in-browser agent workspace
- `skills/`: canonical bundled skill sources checked into the repo
- `lib/`: shared TypeScript libraries used by the workspace
- `docs/`: focused project docs and implementation plans
- `reference_impl/`: deeper feature research, architecture notes, and exploratory docs

## Quickstart

### Prerequisites

- Node.js and npm compatible with the workspace dependencies
- A local checkout of this repository

### Install dependencies

From the repository root:

```bash
npm install
```

### Run the primary app

```bash
npm run dev:agent-browser
```

This starts the `agent-browser` Vite dev server. In VS Code, opening the workspace should also auto-start the same dev server through [`.vscode/tasks.json`](./.vscode/tasks.json).

### Verify the primary app

```bash
npm run verify:agent-browser
```

This runs the full documented verification flow for `agent-browser`:

- TypeScript linting
- Vitest coverage
- Production build
- `npm audit --audit-level=moderate`
- Visual smoke validation via Playwright

If you only need the UI smoke check, run:

```bash
npm run visual:agent-browser
```

The visual smoke script writes a screenshot to `output/playwright/agent-browser-visual-smoke.png`.

## Codespaces Note

When working in GitHub Codespaces, use the forwarded Codespaces URL for browser navigation. Keep `http://localhost:<port>` for tools running inside the container, such as `curl`, Playwright, or local health checks.

To print the forwarded preview URL for port `5173`:

```bash
./skills/agent-harness-context/scripts/codespaces-uri.sh 5173
```

## Where To Go Next

- [`agent-browser/README.md`](./agent-browser/README.md): app-specific commands, hot reload behavior, and Codespaces notes
- [`agent-browser/docs/features.md`](./agent-browser/docs/features.md): visual feature guide and interaction walkthroughs
- [`reference_impl/README.md`](./reference_impl/README.md): research and reference designs
- [`AGENTS.md`](./AGENTS.md): repository-specific implementation and verification rules for coding agents

## Bundled skills

The vendored project skills live in the repo-root `skills/` directory so compatible agents can discover them directly from the checkout.

- Canonical skill sources: `skills/<skill-name>/`
- Compatibility links for agent tooling: `.agents/skills/<skill-name>` and `.claude/skills/<skill-name>`
- Copy or symlink the whole skill directory so bundled assets such as `agents/`, `scripts/`, and data files stay intact

## Installing a bundled skill in another repo

From the target repository:

```bash
mkdir -p .agents/skills
ln -snf /path/to/agent_harness/skills/frontend-design .agents/skills/frontend-design
```

If your agent client expects Claude-style project skills, create the matching link there as well:

```bash
mkdir -p .claude/skills
ln -snf /path/to/agent_harness/skills/frontend-design .claude/skills/frontend-design
```

Some skills include nested agent instructions, for example `skills/skill-creator/agents/`. You do not install those separately; copying or symlinking the parent skill directory installs the packaged agents with it.

## Copilot setup

Copilot setup still attempts to register the Superpowers marketplace/plugin for Copilot sessions, but the bundled skills are checked into the repository instead of being installed during setup.
