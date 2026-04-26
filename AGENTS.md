# AGENTS.md

## git usage

Always use `git mv` to rename/move files.
When running inside Codex Windows sandbox or automation sessions, prefer `scripts/codex-git.ps1` over bare `git` so the current worktree is passed through `safe.directory`.
When a task needs `gh` in those same sessions, prefer `scripts/codex-gh.ps1` over bare `gh`. It initializes `CODEX_HOME`, seeds a readable GitHub CLI config under `$CODEX_HOME/gh-cli`, and sets `GH_CONFIG_DIR` before invoking the CLI.
Do not assume `$env:CODEX_HOME` is already set in automation shells. If you need automation memory paths or GitHub CLI state, initialize the repo environment first with `scripts/codex-shell-init.ps1` or use the wrappers above.

## agent-skills

If you make agent-skills, put them in the root skill dir (~/skills). symlink them into the "~/.agents/skills" dir.
Always make them using Anthropic's "skill-creator" skill (npx skills add https://github.com/anthropics/skills --skill skill-creator)

- Bundled skills live canonically under `skills/<skill-name>/`.
- `.agents/skills/<skill-name>` and `.claude/skills/<skill-name>` must be symlinks to `../../skills/<skill-name>`.
- When adding or updating a bundled skill, make changes in `skills/` and keep both compatibility symlinks in sync.
- Do not duplicate or hand-edit copied skill trees under `.agents/skills/` or `.claude/skills/`; use the symlinks instead.

## Code

Always use TDD with code coverage metrics to ensure 100% coverage.
Use Playwright to visually validate your work in the browser afterwards.
Take screenshots of the outcomes and put them into your PR description so we can view the outcomes that you believe are successful.

For `agent-browser` chat agents, implement first-class agents under `agent-browser/src/chat-agents/<AgentName>/` and wire them through the chat-agent provider/routing layer. Do not add product chat agents as default workspace `.agents/<name>/AGENTS.md` files; those workspace files are user/project instructions, not Agent Browser's internal agent implementation surface.

Prefer deterministic, checked-in scripts over generated one-off CLI commands. Before writing an inline Playwright snippet, shell loop, temporary Node/Python script, or long ad hoc command, check `package.json`, `scripts/`, and relevant skill `scripts/` directories for an existing command. If you repeat a dynamic command sequence or expect future agents to need it, promote it into a documented repo script with tests or verification coverage, then call that script by name.

For `agent-browser` changes, do not stop at targeted tests. Before final response or PR handoff, run `npm run verify:agent-browser` from the repo root. Treat every build, lint, test, npm install, and npm audit warning or error as blocking, including unrelated issues discovered while working. Fix those issues in the same turn whenever they are in the workspace and can be fixed without reverting user work.

For repeatable browser validation, use `npm run visual:agent-browser` instead of ad hoc Playwright CLI sequences. It starts an isolated Vite server on a free localhost port, verifies the Agent Browser shell, and writes a screenshot to `output/playwright/agent-browser-visual-smoke.png`. The full `npm run verify:agent-browser` script runs this visual smoke check after lint, tests, build, and audit.

Keep `npm audit --audit-level=moderate` clean. If a vulnerable transitive dependency cannot be removed, pin or override the patched version and run the full verification script again so dependency, lockfile, lint, test, and build health are checked together.

## Browsing and debugging

When this repo is running inside a GitHub Codespace, do not use `http://localhost:<port>` as the browser URL or OAuth/debug redirect URI.

- Use `http://localhost:<port>` only for tools running inside the container, such as `curl`, Playwright, or server health checks.
- Use the forwarded Codespaces URL for browser navigation, VS Code Simple Browser, manual debugging, and any redirect URI that must round-trip through the browser.
- Generate the forwarded base URL by running `skills/agent-harness-context/scripts/codespaces-uri.sh <port>`.
- Generate a full redirect URI by running `skills/agent-harness-context/scripts/codespaces-uri.sh <port> /auth/callback`.
- The script queries the required Codespaces environment variables, builds the forwarded URL, and prints the final URI on stdout.
- If a third-party auth provider needs to call back to the app, or the forwarded URL returns `401`, make the port public first with `gh codespace ports visibility -c "$CODESPACE_NAME" "${PORT}:public"`.
- Or let the script do both steps with `skills/agent-harness-context/scripts/codespaces-uri.sh --public --check <port> /auth/callback`.

### agent-browser hot reload

- Opening the workspace should auto-start the agent-browser Vite server through the workspace task in `.vscode/tasks.json`.
- Opening the workspace in Codespaces should also auto-open VS Code Simple Browser to the forwarded URL for port `5173`.
- If the forwarded URL is not yet browser-accessible, the preview helper promotes port `5173` and retries before opening Simple Browser.
- If the preview helper extension was just installed during post-create, reload the VS Code window once so startup activation can run.
- Manual fallback: run the `Agent Harness: Open Agent Browser Preview` command or use `.vscode/launch.json` if the preview did not open automatically.

## Scaffolding

Use project specific cli tools to scaffold instead of manually creating/editing files (dotnet, uv, npm, etc.)

## lib/ project conventions

Self-contained TypeScript libraries live under `lib/<name>/`. Each follows this structure:

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
- **AI SDK**: Vercel AI SDK (`ai` ^6, `@ai-sdk/openai` ^1) declared as a `peerDependency`; installed as a `devDependency` for tests
- **Scripts**: `test` → `vitest run`, `test:watch` → `vitest`, `test:coverage` → `vitest run --coverage`
- No bundler step — consumers import TypeScript source directly via the `exports` map

### Coverage requirements

`vitest.config.ts` must enforce 100% on lines, branches, functions, and statements:

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov'],
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.test.ts', 'src/__tests__/**', 'src/index.ts'],
  thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
}
```

### Existing libs

| Library | Purpose |
|---|---|
| `lib/inbrowser-use` | Playwright-shaped in-app DOM control runtime |
| `lib/logact` | LogAct agentic reliability pattern (Meta Labs, arXiv 2604.07988) — deconstructed state-machine agents backed by a shared append-only log |
| `lib/agent-browser-mcp` | Agent-browser MCP server — all agent-browser-specific tool, resource, prompt, and prompt-template definitions (e.g. the WebMCP bridge). Add new MCP features here. |
| `lib/webmcp` | Spec-faithful WebMCP polyfill and runtime (ModelContext, ToolRegistry, install). Generic — no agent-browser specifics. |
