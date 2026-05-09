# Cloud Agent PR Review, Fixer, And Slack Ingress

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo Code Cloud turns GitHub pull requests and Slack threads into first-class entry points for an autonomous coding team made up of specialized cloud agents.

## Evidence
- Official docs: [Roo Code Cloud Overview](https://docs.roocode.com/roo-code-cloud/overview)
- Official docs: [GitHub Integration](https://docs.roocode.com/roo-code-cloud/github-integration)
- Official docs: [Slack Integration](https://docs.roocode.com/roo-code-cloud/slack-integration)
- First-party details:
  - Roo Cloud says agents can plan, code, review, and fix issues autonomously from GitHub PRs, Slack messages, or the web browser
  - the Coder agent can make changes, commit them, push the branch, and open a PR
  - the Reviewer agent leaves GitHub PR comments and can review subsequent commits on the same branch
  - the Fixer agent reads comments and pushes fixes back onto the PR branch
  - Slack users can mention the bot, choose an agent plus repository, and run the session inside a thread
- Latest development checkpoint:
  - the current cloud docs frame GitHub and Slack as equal operating surfaces for the same shared agent team rather than as thin notification channels

## Product signal
Roo is aiming for a coding harness that lives where code review and team conversation already happen, not only inside the editor.
