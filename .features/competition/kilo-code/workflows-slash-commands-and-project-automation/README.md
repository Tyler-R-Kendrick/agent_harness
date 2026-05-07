# Workflows, Slash Commands, And Project Automation

- Harness: Kilo Code
- Sourced: 2026-05-07

## What it is
Kilo packages repeatable multi-step tasks as markdown-backed workflows invoked through slash commands, so agent automation lives in versioned files inside the project.

## Evidence
- Official docs: [Workflows](https://kilo.ai/docs/customize/workflows)
- Official docs: [Customize overview](https://kilo.ai/docs/customize)
- First-party details:
  - Kilo says workflows are markdown files stored in `.kilo/commands/`
  - command files can declare description, agent, model override, and subtask behavior in frontmatter
  - workflows can use built-in tools such as `read`, `glob`, `grep`, `edit`, `write`, `bash`, `webfetch`, and MCP tools
  - the docs include patterns for release management, project setup, and code review preparation
  - Kilo automatically migrates legacy workflows from older directories into the new command format
- Official visual:
  - the workflows docs include a "Workflows tab in Kilo Code" product image
- Latest development checkpoint:
  - the current extension has renamed this surface around slash commands while keeping the repo-owned workflow file model, which suggests Kilo wants procedural automation to stay inspectable and editable

## Product signal
Kilo is turning prompt macros into version-controlled operational scripts that still run through the agent rather than bypassing it.