# AGENTS.md

## git usage

Always use `git mv` to rename/move files.

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

## Browsing and debugging

When this repo is running inside a GitHub Codespace, do not use `http://localhost:<port>` as the browser URL or OAuth/debug redirect URI.

- Use `http://localhost:<port>` only for tools running inside the container, such as `curl`, Playwright, or server health checks.
- Use the forwarded Codespaces URL for browser navigation, VS Code Simple Browser, manual debugging, and any redirect URI that must round-trip through the browser.
- Generate the forwarded base URL by running `skills/agent-harness-context/scripts/codespaces-uri.sh <port>`.
- Generate a full redirect URI by running `skills/agent-harness-context/scripts/codespaces-uri.sh <port> /auth/callback`.
- The script queries the required Codespaces environment variables, builds the forwarded URL, and prints the final URI on stdout.
- If a third-party auth provider needs to call back to the app, or the forwarded URL returns `401`, make the port public first with `gh codespace ports visibility -c "$CODESPACE_NAME" "${PORT}:public"`.
- Or let the script do both steps with `skills/agent-harness-context/scripts/codespaces-uri.sh --public --check <port> /auth/callback`.

## Scaffolding

Use project specific cli tools to scaffold instead of manually creating/editing files (dotnet, uv, npm, etc.)
