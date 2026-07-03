# Agent Harness

Agent Harness is a monorepo for experimenting with agent-oriented desktop and browser UX, with `agent-browser` as the primary runnable app and `skills/` as the checked-in bundled skill library.

This repository is most useful for contributors working on the `agent-browser` prototype, maintainers evolving shared agent skills, and readers inspecting reference feature explorations under `reference_impl/`.

## Repository layout

- `agent-browser/`: React + Vite prototype for the in-browser agent workspace
- `agent-daemon/`: optional local inference companion service for OpenAI-compatible loopback endpoints
- `harness-core/`: reusable TypeScript agent-loop runtime, command, storage, and plugin-manifest primitives
- `skills/`: canonical bundled skill sources checked into the repo
- `lib/`: shared TypeScript libraries used by the workspace
- `lib/workers/`: specialized worker-provider packages layered on top of `@agent-harness/worker`
- `ext/`: installable extension packages for IDE, harness, provider, and worker features
- `plugins/`: repo-local plugin projects and plugin-scaffold experiments
- `dev-evals/`: dev-time eval suites kept outside the product verification path
- `docs/`: focused project docs and implementation plans
- `competition/`: structured competitor dossiers for browser, agent, and automation products
- `research/`: paper-by-paper research packets and implementation notes
- `reference_impl/`: deeper feature research, architecture notes, and exploratory docs

## Quickstart

### Prerequisites

- Node.js 20.x and npm
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

### Run focused workspace validation in Codex automation shells

Before running a workspace-local `test`, `test:coverage`, `lint`, or `build` command that depends on package-local tools such as Vitest from a Codex Windows automation session, prepare that workspace first:

```bash
npm.cmd run prepare:workspace-tests -- --workspace <workspace-name>
```

Example for `agent-browser`:

```bash
npm.cmd run prepare:workspace-tests -- --workspace agent-browser
```

Use this preparation step before targeted commands such as `npm.cmd --workspace agent-browser run test:coverage` so missing local runners are treated as a setup problem instead of a false documentation or verification failure.

## Codespaces Note

When working in GitHub Codespaces, use the forwarded Codespaces URL for browser navigation. Keep `http://localhost:<port>` for tools running inside the container, such as `curl`, Playwright, or local health checks.

To print the forwarded preview URL for port `5174`:

```bash
./skills/agent-harness-context/scripts/codespaces-uri.sh 5174
```

## Local inference paths

Agent Harness currently exposes two distinct local-inference setup paths:

- **Built-in local inference (Codi)** runs a browser-compatible ONNX text-generation model directly inside `agent-browser` with no localhost sidecar.
- **Local OpenAI-compatible endpoint** keeps inference in a user-managed local runtime such as LM Studio or Ollama and connects through the installable Local Model Connector extension.

If you need the companion service that packages or runs the local inference daemon, start with [`agent-daemon/README.md`](./agent-daemon/README.md). If you need the browser extension path for approved hosted PWAs, start with [`ext/provider/local-model-connector/README.md`](./ext/provider/local-model-connector/README.md).

## Where To Go Next

- [`agent-browser/README.md`](./agent-browser/README.md): app-specific commands, hot reload behavior, and Codespaces notes
- [`agent-daemon/README.md`](./agent-daemon/README.md): local inference daemon packaging, compile targets, and service install flow
- [`agent-browser/docs/features.md`](./agent-browser/docs/features.md): visual feature guide and interaction walkthroughs
- [`competition/README.md`](./competition/README.md): competitor dossier index and cross-market takeaways
- [`dev-evals/agent-chat/README.md`](./dev-evals/agent-chat/README.md): opt-in dev eval runners for chat self-improvement work
- [`plugins/deep-research-harness-ide/README.md`](./plugins/deep-research-harness-ide/README.md): repo-local IDE plugin prototype for deep research workflows
- [`research/README.md`](./research/README.md): research packet index and per-paper directory contract
- [`reference_impl/README.md`](./reference_impl/README.md): research and reference designs
- [`AGENTS.md`](./AGENTS.md): repository-specific implementation and verification rules for coding agents

## Other maintained surfaces

These directories are intentionally outside the workspace package table, but they are still active parts of the repository:

- [`competition/README.md`](./competition/README.md): parseable competitor dossiers for market tracking and product positioning
- [`dev-evals/agent-chat/README.md`](./dev-evals/agent-chat/README.md): local-only heuristic evals that should not be wired into CI
- [`plugins/deep-research-harness-ide/README.md`](./plugins/deep-research-harness-ide/README.md): experimental runtime plugin work derived from the repo's plugin standards
- [`research/README.md`](./research/README.md): research packet workspace for papers, experiments, and integration notes
- [`docs/plugin-standards.md`](./docs/plugin-standards.md): canonical plugin package and marketplace manifest contract

## Workspace packages

The root README is the package index. Use the linked package README for public API details, examples, and focused validation commands.

| Workspace | Import path | Purpose |
|---|---|---|
| [`agent-browser/README.md`](./agent-browser/README.md) | `agent-browser` | Primary React + Vite application shell, chat-agent runtime, and browser workspace UI. |
| [`ext/README.md`](./ext/README.md) | `ext/*/*` | Workspace index for the public IDE, harness, provider, and worker extension packages. |
| [`harness-core/README.md`](./harness-core/README.md) | `harness-core` | Reusable agent-loop runtime, command, storage, constrained-decoding, and plugin-manifest primitives. |
| [`lib/a2a/README.md`](./lib/a2a/README.md) | `@agent-harness/a2a` | In-process Agent-to-Agent protocol surface: agent-card build/validate and a never-throw dispatch/compose router. |
| [`lib/agent-browser-mcp/README.md`](./lib/agent-browser-mcp/README.md) | `@agent-harness/agent-browser-mcp` | Agent Browser MCP tools, resources, prompts, prompt templates, and WebMCP bridge helpers. |
| [`lib/agent-sandbox/README.md`](./lib/agent-sandbox/README.md) | `@agent-harness/agent-sandbox` | Capability-based sandbox provider for governed browser agent execution. |
| [`lib/browser-durable-tasks/README.md`](./lib/browser-durable-tasks/README.md) | `@agent-harness/browser-durable-tasks` | Browser-native durable task state management backed by IndexedDB. |
| [`lib/claimify/README.md`](./lib/claimify/README.md) | `@agent-harness/claimify` | Browser-local factual claim extraction and evidence normalization utilities. |
| [`lib/core-tool-api/README.md`](./lib/core-tool-api/README.md) | `@agent-harness/core-tool-api` | Core tool registration and execution API for worker and sandbox integrations. |
| [`lib/cost-aware-routing/README.md`](./lib/cost-aware-routing/README.md) | `cost-aware-routing` | Deterministic cost-aware model routing helpers. |
| [`lib/durable-workflow-adapter/README.md`](./lib/durable-workflow-adapter/README.md) | `@agent-harness/durable-workflow-adapter` | Opt-in durable workflow runner over the browser durable-tasks runtime. |
| [`lib/git-stub/README.md`](./lib/git-stub/README.md) | `@agent-harness/git-stub` | Git-style command shim used for browser and just-bash session flows. |
| [`lib/harness-archive/README.md`](./lib/harness-archive/README.md) | `@agent-harness/harness-archive` | Harness evolution archive with genome lineage recording. |
| [`lib/harness-otel-export/README.md`](./lib/harness-otel-export/README.md) | `@agent-harness/harness-otel-export` | OpenTelemetry exporter emitting GenAI-semconv spans with reward slots. |
| [`lib/harness-task-manager/README.md`](./lib/harness-task-manager/README.md) | `@agent-harness/task-manager` | Internal browser task and state manager for harness workflows. |
| [`lib/inbrowser-use/README.md`](./lib/inbrowser-use/README.md) | `inbrowser-use` | Playwright-shaped in-app DOM control runtime. |
| [`lib/intent-dsl/README.md`](./lib/intent-dsl/README.md) | `@agent-harness/intent-dsl` | Canonical intent DSL: grammar emission, .min.map minifier, and the grammar-registration plugin. |
| [`lib/lean-browser/README.md`](./lib/lean-browser/README.md) | `@agent-harness/lean-browser` | Browser-local Lean-backed validation and reasoning utilities. |
| [`lib/llguidance-wasm/README.md`](./lib/llguidance-wasm/README.md) | `@agent-harness/llguidance-wasm` | Browser-local constrained decoding utilities compatible with llguidance flows. |
| [`lib/logact/README.md`](./lib/logact/README.md) | `logact` | LogAct shared-log reliability primitives and execution building blocks. |
| [`lib/logact-loop/README.md`](./lib/logact-loop/README.md) | `@agent-harness/logact-loop` | LogAct workflow extensions for the generic harness-core agent loop. |
| [`lib/mcp-client/README.md`](./lib/mcp-client/README.md) | `@agent-harness/mcp-client` | Model Context Protocol client bridge for discovering and invoking external MCP server tools. |
| [`lib/prompt-budget/README.md`](./lib/prompt-budget/README.md) | `@agent-harness/prompt-budget` | Prompt budgeting helpers for fitting model messages into a known context window. |
| [`lib/ralph-loop/README.md`](./lib/ralph-loop/README.md) | `ralph-loop` | Ralph Loop completion heuristics and iterative execution helpers. |
| [`lib/recursive-research-agent/README.md`](./lib/recursive-research-agent/README.md) | `@agent-harness/recursive-research-agent` | Bounded recursive research crawler controller for agent workflows. |
| [`lib/sandbox-policy/README.md`](./lib/sandbox-policy/README.md) | `@agent-harness/sandbox-policy` | OpenShell-style sandbox policy parser/compiler targeting the browser sandbox adapters. |
| [`lib/search-answering/README.md`](./lib/search-answering/README.md) | `@agent-harness/search-answering` | Deterministic direct-source answer gating and markdown result formatting helpers. |
| [`lib/skill-lifecycle/README.md`](./lib/skill-lifecycle/README.md) | `@agent-harness/skill-lifecycle` | Eval-gated skill lifecycle: Memp candidate/active/deprecated states and SkillOpt bounded-edit gate. |
| [`lib/webmcp/README.md`](./lib/webmcp/README.md) | `@agent-harness/webmcp` | Spec-faithful WebMCP polyfill, registry helpers, and model-context runtime utilities. |
| [`lib/worker/README.md`](./lib/worker/README.md) | `@agent-harness/worker` | Extensible provider, worker, sandbox, capability, and evaluation primitives. |
| [`lib/workers/README.md`](./lib/workers/README.md) | `lib/workers/*` | Workspace index for the browser and daemon worker-provider packages. |
| [`lib/workers/browser/README.md`](./lib/workers/browser/README.md) | `@agent-harness/worker-browser` | Browser orchestration worker provider that requests sandbox access and runs conventional seeded jobs. |
| [`lib/workers/daemon/README.md`](./lib/workers/daemon/README.md) | `@agent-harness/worker-daemon` | Daemon-backed worker provider that adapts message-oriented daemon actions into generic worker jobs. |
| [`lib/workgraph/README.md`](./lib/workgraph/README.md) | `@agent-harness/workgraph` | Local-first browser work graph for task, artifact, and dependency orchestration. |

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
