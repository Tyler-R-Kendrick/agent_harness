# Skills And Plugins

- Harness: OpenClaw
- Sourced: 2026-05-20

## What it is
OpenClaw has a layered skills system, plugin-shipped skill support, an optional Skill Workshop that can write workspace skills from observed procedures, and a typed simple-plugin SDK path.

## Evidence
- Official docs: [Skills](https://docs.openclaw.ai/tools/skills)
- Official release notes: [OpenClaw 2026.5.18](https://github.com/openclaw/openclaw/releases)
- First-party details:
  - skills load from workspace, `.agents`, personal, managed, bundled, and extra configured directories with explicit precedence
  - plugins can ship skills through `openclaw.plugin.json`, and those skills join normal precedence resolution instead of living in a separate silo
  - the optional Skill Workshop plugin can create or update workspace skills from reusable procedures observed during agent work
  - the stable `2026.5.18` release added `defineToolPlugin` plus `openclaw plugins build`, `validate`, and `init` for typed simple tool plugins
  - the same stable release expanded the bundled skill set with new debugging and diagram-generation skills
- Latest development checkpoint:
  - the May 18, 2026 stable release shows OpenClaw tightening both ends of extensibility at once: better plugin authoring primitives and a richer bundled skill library

## Product signal
OpenClaw is not just letting users install skills. It is building a governed extensibility stack where workflow packaging, runtime plugins, and skill generation all live inside the main product.
