# AI Code Reviews With Local And Remote Modes

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo offers a review agent that can run automatically on GitHub or GitLab pull requests and merge requests, while also exposing local pre-push review commands inside the coding surface.

## Evidence
- Official docs: [Code Reviews](https://kilo.ai/docs/automate/code-reviews/overview)
- Official docs: [Automate overview](https://kilo.ai/docs/automate)
- First-party details:
  - Kilo says reviews can trigger automatically when a PR or MR is opened or updated
  - review styles are configurable as Strict, Balanced, or Lenient
  - focus areas include security, performance, bug detection, style, tests, and documentation
  - output includes inline comments, summary findings, suggested fixes, and risk or severity tagging
  - Kilo also supports local `/local-review` and `/local-review-uncommitted` commands for reviewing changes before pushing
- Latest development checkpoint:
  - the current docs describe code review as an automation surface with both hosted and local entry points, which suggests Kilo is collapsing "review before push" and "review after PR open" into one product line

## Product signal
Kilo is treating review as a continuous agent loop instead of a separate phase owned only by Git hosting platforms.