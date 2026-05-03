# Terminal Integration And Named Sessions

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose can live inside the developer's shell via `@goose`, automatically pull recent command history into context, and keep named sessions alive across terminal restarts.

## Evidence
- Official docs: [Terminal Integration](https://goose-docs.ai/docs/guides/terminal-integration/)
- Official docs: [CLI Commands](https://goose-docs.ai/docs/guides/goose-cli-commands/)
- Official release notes: [Goose v1.30.0](https://github.com/aaif-goose/goose/releases/tag/v1.30.0)
- First-party details:
  - Goose installs shell integrations for zsh, bash, fish, and PowerShell.
  - `@goose` and `@g` let the user ask questions directly from the prompt while Goose sees commands run since the last question.
  - Named terminal sessions persist in Goose's database and can be resumed later from any shell window with the same name.
  - `goose term info` exposes prompt-level context and active model status inside the shell prompt.
  - `v1.30.0` added `goose serve` and an independent `--text` mode for cleaner background or headless use.
- Latest development checkpoint:
  - recent release work shows Goose still investing in terminal-native operation rather than treating CLI support as a thin wrapper around the desktop app

## Product signal
Goose wants to become ambient in the shell. The product keeps pushing context capture, persistence, and low-friction invocation closer to the developer's normal terminal loop.
