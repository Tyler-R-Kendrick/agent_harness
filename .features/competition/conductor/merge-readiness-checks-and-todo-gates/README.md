# Merge Readiness Checks And Todo Gates

- Harness: Conductor
- Sourced: 2026-05-12

## What it is
Conductor exposes a checks surface for deciding whether a workspace is actually ready to land, combining validation commands and unresolved agent todos into one operator-facing gate.

## Evidence
- Official docs: [Checks tab](https://www.conductor.build/docs/reference/checks-tab)
- Official docs: [Issue to PR](https://www.conductor.build/docs/guides/issue-to-pr)
- First-party details:
  - the checks tab runs configured validation commands inside the workspace
  - Conductor shows unresolved todos alongside execution checks
  - the issue-to-PR guide makes the checks step part of the normal flow before creating or merging a PR
- Latest development checkpoint:
  - the current product docs keep merge readiness tied to both automated checks and explicit unfinished work, not just one green test command

## Product signal
This is a useful product pattern for harnesses that want a stronger done-state than "the model said it finished" while still keeping the review surface lightweight.
