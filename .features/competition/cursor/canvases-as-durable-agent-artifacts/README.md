# Canvases As Durable Agent Artifacts

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor can now respond by creating interactive canvases that live alongside the terminal, browser, and source control as durable artifacts of the agent run.

## Evidence
- Official changelog: [Canvases](https://cursor.com/changelog)
- Official changelog: [MCP Apps and Team Marketplaces for Plugins](https://cursor.com/changelog/2-6)
- First-party details:
  - the April 15, 2026 changelog says Cursor can create interactive canvases containing dashboards, custom interfaces, charts, diagrams, tables, diffs, and to-do lists
  - Cursor positions these canvases as durable artifacts in the Agents Window side panel rather than transient markdown in the chat stream
  - this sits adjacent to Cursor's broader push toward interactive MCP Apps, which indicates a larger product move toward richer agent-authored surfaces
  - the canvases live in the same operational shell as terminal, browser, and source control, which makes them part of the execution workspace instead of a detached export
- Latest development checkpoint:
  - the April 15, 2026 release makes interactive agent output a first-class workspace object, which is a meaningful change in harness shape

## Product signal
Cursor is starting to treat agent output as durable interactive UI, not only text or diffs, which expands what the harness can be during planning, execution, and review.
