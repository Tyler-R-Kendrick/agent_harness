# TK-16 Git Stub Terminal

TK-16 asks for Git-style syntax in the Agent Browser `just-bash` terminal. The implementation keeps this as an extension of the existing terminal/session filesystem rather than a new source-control panel.

## Integration

- Added `@agent-harness/git-stub` under `lib/git-stub` with the standard self-contained library layout and 100% coverage thresholds.
- The shim stores repository state in the active session filesystem at `/workspace/.git-stub/state.json`.
- `executeCliCommand` intercepts `git ...` commands before they reach `just-bash` when the session filesystem supports read/write/mkdir.
- Supported commands: `git init`, `git status`, `git status --short`, `git add`, `git commit -m`, `git log`, `git log --oneline`, `git diff`, `git diff --cached`, `git branch`, and `git checkout -b`.
- Terminal history, current working directory, chat transcript output, and Files tree refresh still flow through the existing CLI executor path.

## TDD Evidence

- RED: `npm.cmd --workspace @agent-harness/git-stub run test:coverage` initially failed below the required 100% thresholds.
- GREEN: `npm.cmd --workspace @agent-harness/git-stub run test:coverage` passes at 100% statements, branches, functions, and lines.
- GREEN: `npm.cmd --workspace agent-browser run test -- src/tools/cli/gitStub.test.ts src/tools/cli/exec.test.ts` covers the terminal adapter and the bound just-bash filesystem methods.
- GREEN: `npm.cmd --workspace agent-browser run smoke:git-stub` passes against the deterministic git-stub behavior harness.

## Validation Notes

`npm.cmd run verify:agent-browser` passed end to end after dependency hydration. The visual smoke script includes the terminal `git init` and `git status --short` flow and writes `docs/superpowers/plans/2026-05-09-git-stub-terminal-visual-smoke.png`.
