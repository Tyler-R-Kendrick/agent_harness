# agent-browser

The `agent-browser` app is a React and Vite workspace inside the `agent_harness` repository.

The `agent-skills/` directory contains the checked-in default workspace skills that the app copies into each runtime workspace under `.agents/skills/`.

## Hot reload in Codespaces

Opening the repository in VS Code should start the Vite dev server automatically through `.vscode/tasks.json`. In Codespaces, the workspace also installs a small local helper extension that opens VS Code Simple Browser to the forwarded URL for port `5174`.

The browser-facing URL should always come from `../skills/agent-harness-context/scripts/codespaces-uri.sh 5174`. The preview helper first validates that forwarded URL, and if it is not yet browser-accessible it retries with `--public --check` before opening Simple Browser. Use `http://localhost:5174` only for tooling that runs inside the container, such as `curl`, Playwright, or local health checks.

If the helper extension was installed during the current session, reload the VS Code window once so the startup activation runs.

## Commands

- `npm run dev` starts the hot-reload server on port `5174`.
- `npm run dev:cucumber` starts the test server on port `4173`.
- `npm run build` produces the production bundle.
- `npm run test` runs the Vitest suite.
- `npm run test:coverage` runs Vitest with coverage.
- `npm run test:cucumber` starts the dedicated test server and runs the Cucumber tests.
- `npm run lint` runs TypeScript in no-emit mode.

## Manual fallbacks

- Run the `Agent Harness: Open Agent Browser Preview` command if the preview did not open automatically.
- Use `.vscode/launch.json` if you want to start or debug the dev server manually.
- Run `../skills/agent-harness-context/scripts/codespaces-uri.sh 5174` if you need to inspect or reuse the forwarded URL directly.
