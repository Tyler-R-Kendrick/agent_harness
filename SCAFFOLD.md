# SCAFFOLD.md

Semantic map of the repository. This is the orientation layer: what each
top-level directory and load-bearing root file is *for*, so agents and
contributors can navigate without crawling the tree. `README.md` is the
package index (public APIs, per-package links); this file is the semantic
scaffold. Keep them in sync — `scripts/check-scaffold-in-sync.mjs` (wired into
`npm run test:root-scripts`) fails if a new top-level directory is added
without an entry here.

## Product & workspace surfaces

- `agent-browser/` — Primary runnable app: React + Vite in-browser agent
  workspace shell, chat-agent runtime, evals. Import path `agent-browser`.
- `harness-core/` — Reusable TypeScript agent-loop runtime: agent loop,
  actors, hooks, event loop, memory, secrets, commands, settings, plugins +
  manifests, renderers, tools, model providers, constrained decoding, and
  OTel telemetry. Import path `harness-core`.
- `agent-daemon/` — Optional local-inference companion service exposing an
  OpenAI-compatible loopback endpoint.
- `lib/` — Self-contained TypeScript libraries consumed across the workspace
  (see `## lib/ project conventions` below and the README workspace table for
  the per-package index). `lib/workers/` holds worker-provider packages built
  on `@agent-harness/worker`.
- `ext/` — Installable extension packages (`ext/<category>/<name>`) for IDE,
  harness, provider, and worker features, following `docs/plugin-standards.md`.

## Maintained non-package surfaces

- `plugins/` — Repo-local plugin projects and plugin-scaffold experiments.
- `dev-evals/` — Dev-time eval suites deliberately kept outside the product
  verification path (not wired into CI).
- `docs/` — Focused project docs, ADRs (`docs/adr/`), architecture notes
  (`docs/architecture/`), and implementation plans.
- `research/` — Paper-by-paper research packets (`<slug>-<id>/` with README,
  reference-architecture, and experiments), governed by the
  `research-experimenter` skill.
- `competition/` — Structured competitor dossiers for browser, agent, and
  automation products.
- `reference_impl/` — Deeper feature research, architecture notes, and the
  exploratory browser prototype. Conceptual guidance, not the live
  implementation; prefer live code and tests on conflict.
- `skills/` — Canonical bundled skill sources (`skills/<name>/`), surfaced to
  agent tooling through `.claude/skills` and `.agents/skills` symlinks.

## Infrastructure & tooling

- `api/` — Vercel-style serverless Node HTTP handlers (`web-search.ts`,
  `web-page.ts`, and their `*-runtime.ts`); the repo's hosted backend surface.
- `scripts/` — Checked-in repo automation: the `agent-browser` verifier,
  `check-*-clean.mjs` hygiene checks (each with a co-located `.test.mjs`),
  Codex shell wrappers, workspace-test prep, and the Vercel install script.
  Prefer these over generated one-off commands.
- `tools/` — Repo tooling; currently the `agent-browser-preview-extension`
  VS Code preview helper.
- `vendor/` — Vendored npm stubs (e.g. `vendor/npm-stubs/mongodb-js-zstd`)
  referenced by root `package.json` `overrides`.
- `patches/` — `patch-package` patches applied via `postinstall`.

## Load-bearing root files

- `package.json` — npm workspaces (`agent-browser`, `ext/*/*`, `harness-core`,
  `lib/*`, `lib/workers/*`) plus the orchestration script index and
  dependency `overrides`.
- `README.md` — The package index (public APIs, per-package links).
- `AGENTS.md` — Repository operating rules for coding agents. Injected verbatim
  into agent prompts by the `ext/harness/agents-md` plugin.
- `STEERING.md` — Generalized reasoning-strategy corrections (how to reason),
  distinct from AGENTS.md's operating rules.
- `MEMORY.md` — Durable, cross-session facts and corrections.
- `DESIGN.md` — The Agent Browser UI design system (compact Material-inspired
  IDE rules). Unrelated to engineering design docs, which live in
  `docs/architecture/`.
- `vercel.json` — Deploy config: builds `agent-browser` as a static SPA.
- `skills-lock.json` — Bundled-skill lockfile (source + integrity hash per
  skill).
- `workflow-ui-snapshot.yml` — Workflow-canvas UI snapshot fixture.

## lib/ project conventions

Self-contained TypeScript libraries live under `lib/<name>/`. Each follows this
structure:

```
lib/<name>/
  package.json        # "type": "module"; main/types/exports all point to ./src/index.ts
  tsconfig.json       # strict mode, ESNext, bundler module resolution
  vitest.config.ts    # v8 coverage, 100% threshold on all metrics
  src/
    index.ts          # barrel – re-exports public API (excluded from coverage)
    types.ts          # shared interfaces / type aliases
    *.ts              # feature modules
    __tests__/
      *.test.ts       # co-located unit tests, one file per module
```

### Tooling

- **Test runner / coverage**: `vitest` + `@vitest/coverage-v8` (no Jest)
- **AI SDK**: Vercel AI SDK (`ai` ^6, `@ai-sdk/openai` ^1) declared as a
  `peerDependency`; installed as a `devDependency` for tests
- **Scripts**: `test` → `vitest run`, `test:watch` → `vitest`,
  `test:coverage` → `vitest run --coverage`
- No bundler step — consumers import TypeScript source directly via the
  `exports` map

### Coverage requirements

`vitest.config.ts` must enforce 100% on lines, branches, functions, and
statements:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts', 'src/__tests__/**', 'src/index.ts'],
  thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
}
```

See the README workspace table for the full per-library purpose index.
