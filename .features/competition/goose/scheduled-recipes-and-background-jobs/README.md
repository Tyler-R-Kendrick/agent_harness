# Scheduled Recipes And Background Jobs

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose can run recipes on cron-like schedules, keep those runs in the background, and preserve the resulting sessions for later inspection or restore.

## Evidence
- Official docs: [Reusable Recipes](https://goose-docs.ai/docs/guides/recipes/session-recipes/)
- Official docs: [CLI Commands](https://goose-docs.ai/docs/guides/goose-cli-commands/)
- First-party details:
  - Goose lets users schedule recipes from the desktop Recipe Library or from the dedicated Scheduler page.
  - Scheduled runs support background or foreground execution modes.
  - The CLI exposes `goose schedule add`, `list`, `sessions`, `run-now`, and `remove`.
  - Schedule detail pages keep last-run information plus the sessions created by each scheduled recipe and allow restore or manual rerun.
- Latest development checkpoint:
  - Goose now treats recurring automation as a built-in workflow layer tied directly to reusable recipes and durable session history

## Product signal
Goose is making automation operational, not ornamental. Recipes are not just reusable prompts; they are schedulable jobs with session history and operator controls.
