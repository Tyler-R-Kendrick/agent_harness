# Shared Task Console With Transcript Diff Logs And Artifacts

- Harness: Roomote
- Sourced: 2026-05-08

## What it is
Roomote exposes a shared task UI where teammates can inspect the transcript, diff, logs, previews, artifacts, and task metadata before work ships.

## Evidence
- Official product page: [Roomote](https://roomote.dev/)
- First-party details:
  - the page says the task UI gives teams a shared place to inspect the transcript
  - it also lists diff, logs, previews, artifacts, and task info as part of that UI
  - the product positions this as the review surface for repository-changing work
- Latest development checkpoint:
  - Roomote is explicitly packaging the run artifact as a multi-pane review console instead of leaving review scattered across chat, CI, and GitHub tabs

## Product signal
Roomote is turning agent execution into a shared operational object that non-authors can audit before approving delivery.
