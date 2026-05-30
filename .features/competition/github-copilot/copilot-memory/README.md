# Copilot Memory

- Harness: GitHub Copilot
- Sourced: 2026-05-30

## What it is
Copilot Memory stores validated repository facts plus user-level preferences, reuses them across Copilot surfaces, and now exposes stronger deletion, scope, and governance controls.

## Evidence
- Docs: [About GitHub Copilot Memory](https://docs.github.com/en/enterprise-cloud%40latest/copilot/concepts/agents/copilot-memory)
- Docs: [Managing and curating Copilot Memory](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/copilot-memory)
- Changelog: [Copilot Memory supports user preferences for Pro, Pro+ users](https://github.blog/changelog/2026-05-15-copilot-memory-supports-user-preferences-for-pro-pro-users/)
- Changelog: [Copilot Memory has more controls for deletion, scope, and the Copilot CLI](https://github.blog/changelog/2026-05-26-copilot-memory-has-more-controls-for-deletion-scope-and-the-copilot-cli/)
- GitHub documents:
  - repository-level facts are stored with citations to current code and validated before reuse
  - user-level preferences can remember preferred commit style, pull-request structure, and communication style
  - cloud agent, code review, and Copilot CLI can share memory-derived context rather than each relearning it
  - repository owners can inspect and delete stored facts, while enterprises, organizations, repositories, and users now have stronger enablement and disablement controls

## Product signal
GitHub is moving from passive repo memory toward a multi-scope memory layer with explicit provenance, curation, and administrative governance.
