# Repository-Admin Memory Governance And Guided Forgetting

- Harness: GitHub Copilot
- Sourced: 2026-05-30

## What it is
Copilot Memory now includes explicit enterprise, organization, repository, and user controls so stored facts can be enabled, reviewed, deleted, or disabled without giving up the rest of the harness.

## Evidence
- Docs: [About GitHub Copilot Memory](https://docs.github.com/en/enterprise-cloud%40latest/copilot/concepts/agents/copilot-memory)
- Docs: [Managing and curating Copilot Memory](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/copilot-memory)
- Changelog: [Copilot Memory has more controls for deletion, scope, and the Copilot CLI](https://github.blog/changelog/2026-05-26-copilot-memory-has-more-controls-for-deletion-scope-and-the-copilot-cli/)
- GitHub documents:
  - facts learned by one Copilot surface can be reused by cloud agent, code review, and Copilot CLI
  - enterprise owners can force `Enabled everywhere`, `Disabled everywhere`, or delegate enablement to organizations
  - repository owners can inspect stored repository facts in repo settings and delete misleading or stale entries
  - users can review or delete their own preferences, and the latest release adds clearer forgetting guidance plus a repository-level off switch

## Product signal
Persistent memory is graduating from a hidden convenience to an administered subsystem with kill switches, curation, and scope-aware governance.
