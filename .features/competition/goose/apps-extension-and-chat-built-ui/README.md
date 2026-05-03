# Apps Extension And Chat-Built UI

- Harness: Goose
- Sourced: 2026-05-03

## What it is
The Apps extension lets Goose create and manage simple custom apps through chat, then surface them as MCP App resources in standalone sandboxed windows.

## Evidence
- Official docs: [Apps Extension](https://goose-docs.ai/docs/mcp/apps-mcp/)
- Official release notes: [Goose v1.19.0](https://github.com/aaif-goose/goose/releases/tag/v1.19.0)
- First-party details:
  - Goose says apps can be calculators, dashboards, simple games, and interactive widgets.
  - The Apps extension stores each app as a single HTML file and lets the user create, modify, and delete those apps from chat.
  - Apps are exposed as MCP App resources and can be launched from the Apps page or requested in chat.
  - `v1.19.0` added an MCP app renderer for richer UI experiences.
- Latest development checkpoint:
  - Goose is actively tightening the renderer and resource plumbing around MCP Apps, which suggests the app surface is becoming a durable part of the harness instead of a novelty

## Product signal
Goose is moving beyond transcript-only output by letting the agent build lightweight UI surfaces that persist as runnable artifacts inside the product.
