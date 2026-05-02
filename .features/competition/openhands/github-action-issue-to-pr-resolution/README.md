# GitHub Action Issue-To-PR Resolution

- Harness: OpenHands
- Sourced: 2026-05-02

## What it is
OpenHands ships a GitHub Action flow where issues or pull requests can trigger agent work directly from GitHub, with iterative follow-up through labels, comments, review comments, and inline feedback.

## Evidence
- Official docs: [OpenHands GitHub Action](https://docs.openhands.dev/openhands/usage/run-openhands/github-action)
- First-party details:
  - adding the `fix-me` label or commenting with `@openhands-agent` triggers resolution attempts
  - the docs describe an iterative loop where reviewers inspect the resulting PR and follow up through general comments, review comments, or inline thread comments
  - OpenHands distinguishes whole-thread requests via `fix-me` from narrower comment-scoped requests via `@openhands-agent`
- Latest development checkpoint:
  - the current docs present this as an installable workflow teams can use in their own repositories, not only inside OpenHands' own repo

## Product signal
OpenHands is leaning into issue-and-PR-native automation, where the repo itself becomes the control surface for repeated agent work instead of forcing users back into a separate app every time.
