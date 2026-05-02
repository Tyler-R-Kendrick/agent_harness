# Automations Beta With Fresh Sandboxes

- Harness: OpenHands
- Sourced: 2026-05-02

## What it is
OpenHands Cloud and Enterprise now support scheduled automations that run full OpenHands conversations on a schedule, with stored secrets, integrations, and git-provider credentials available inside a fresh sandbox for each run.

## Evidence
- Official docs: [Automations Overview](https://docs.openhands.dev/openhands/usage/automations/overview)
- First-party details:
  - OpenHands documents prompt-based and plugin-based automations
  - each automation run creates a fresh sandbox, executes the prompt, saves the conversation, and lets the user continue the conversation later if needed
  - documented use cases include reports, monitoring, dependency checks, vulnerability remediation, cleanup, and GitHub summaries
  - Cloud docs also expose event-based automation pages alongside scheduled automations
- Latest development checkpoint:
  - the current docs mark Automations as a beta feature for OpenHands Cloud and Enterprise and show end-to-end setup through normal conversation flows

## Product signal
This is more than cron plus prompts. OpenHands is turning scheduled work into first-class agent conversations with traceable history, reusable integrations, and follow-up continuity.
