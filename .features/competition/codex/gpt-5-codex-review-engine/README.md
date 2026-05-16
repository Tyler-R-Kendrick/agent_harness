# GPT-5-Codex Review Engine

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex exposes coding-specialized model choices and reasoning controls directly in the CLI and IDE, with newer GPT-5.x Codex variants positioned as the default high-capability engine for long-horizon agentic coding work.

## Evidence
- Official docs: [Codex CLI](https://developers.openai.com/codex/cli), [GPT-5.3-Codex](https://developers.openai.com/api/docs/models/gpt-5.3-codex), [GPT-5.2-Codex](https://developers.openai.com/api/docs/models/gpt-5.2-codex)
- First-party details:
  - the CLI docs call out model switching and reasoning-effort control as standard Codex workflow features
  - GPT-5.2-Codex is described as an upgraded model optimized for long-horizon agentic coding tasks
  - GPT-5.3-Codex is described as the most capable Codex coding model to date
  - both GPT-5.2-Codex and GPT-5.3-Codex support explicit `low`, `medium`, `high`, and `xhigh` reasoning effort settings
- Latest development checkpoint:
  - current Codex positioning is not just "one best model"; it is a model family with explicit reasoning-depth controls surfaced to users inside the harness

## Product signal
Model specialization and reasoning-budget control are first-class harness features rather than invisible backend tuning.
