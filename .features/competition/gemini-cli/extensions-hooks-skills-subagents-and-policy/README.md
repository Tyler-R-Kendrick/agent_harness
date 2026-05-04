# Extensions Hooks Skills Subagents And Policy

- Harness: Gemini CLI
- Sourced: 2026-05-04

## What it is
Gemini CLI packages commands, MCP servers, hooks, tools, prompts, context files, subagents, themes, and policy into a single extension model so teams can ship repeatable harness behavior as installable units.

## Evidence
- Official docs: [Extensions Reference](https://geminicli.com/docs/extensions/reference/)
- First-party details:
  - Extensions can include commands, prompts, tools, MCP configuration, settings, `GEMINI.md` context, hooks, subagents, and themes.
  - The docs describe local, project, and shared installation patterns instead of treating extension reuse as a manual copy-paste workflow.
  - Policy and subagent definitions living inside the same package make extensions operational workflow bundles, not only UI themes or prompt snippets.
- Latest development checkpoint:
  - the current extension reference presents a broad packaged-surface model that goes beyond ordinary command plugins.

## Product signal
Gemini CLI is converging on a workflow package format that captures both behavior and governance. That makes reuse, team rollout, and distribution much easier than ad hoc prompt sharing.
