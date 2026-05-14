# Codex Cloud environment recipe for `agent_harness`

This repository should be configured in **Codex Web → Environments** with:

- **Base image**: `ghcr.io/openai/codex-universal:latest`
- **Setup command**: `bash .codex/setup-remote-env.sh`

## Runtime selection (official `CODEX_ENV_*` variables)

Set these environment variables so Codex installs only the runtimes this repo needs:

```bash
CODEX_ENV_NODE_VERSION=20
```

Do **not** set other `CODEX_ENV_*` language variables unless this repository adds a new required runtime.

## Why this format

OpenAI's `codex-universal` reference image documents runtime control via `CODEX_ENV_*`
variables (for example `CODEX_ENV_NODE_VERSION`) and supports language-specific setup.
This repo is Node/TypeScript-first, so pinning only Node avoids unnecessary runtime setup.
