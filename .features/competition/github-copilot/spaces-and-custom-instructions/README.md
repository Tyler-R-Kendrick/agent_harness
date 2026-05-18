# Spaces And Custom Instructions

- Harness: GitHub Copilot
- Sourced: 2026-04-24

## What it is
Copilot uses Spaces to centralize curated context and layered custom instructions to shape responses and agent behavior across GitHub and IDE agent mode.

## Evidence
- Docs: [GitHub Copilot features](https://docs.github.com/en/copilot/get-started/features)
- Docs: [Using GitHub Copilot Spaces](https://docs.github.com/en/copilot/how-tos/provide-context/use-copilot-spaces/use-copilot-spaces)
- Docs: [Use custom instructions in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)
- Spaces organize code, docs, and specs for grounding.
- Spaces can be accessed from IDE agent mode through the GitHub MCP server and the dedicated `copilot_spaces` toolset.
- Custom instructions can come from workspace files, user profile files, organization-level rules, and extension-contributed sources.
- VS Code exposes diagnostics so users can inspect which instructions were loaded and why.

## Product signal
GitHub is separating persistent context from prompt text and making both reusable.
