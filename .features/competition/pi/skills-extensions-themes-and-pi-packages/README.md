# Skills Extensions Themes And Pi Packages

- Harness: Pi
- Sourced: 2026-05-26

## What it is
Pi exposes most customization through installable resources: prompt templates, skills, extensions, themes, and shareable Pi packages that can be installed globally, per project, or ephemerally for a single run.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
- Official package docs: [docs/packages.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- Official extensions docs: [docs/extensions.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)
- First-party details:
  - the README says prompt templates expand with `/name`, skills load through the Agent Skills standard, themes hot-reload, and extensions can replace or augment large parts of the UI
  - the extensions docs show just how deep that surface goes: custom tools, plan mode, compaction hooks, permission gates, path protection, custom editors, git checkpointing, SSH or sandbox execution, MCP integration, subagents, and full UI widgets
  - `packages.md` shows install sources spanning npm, git refs, raw GitHub URLs, SSH URLs, and local paths
  - project-level installs live in `.pi/settings.json`, missing project packages auto-install on startup, and `pi -e` supports temporary package installs for the current run only
  - package docs now also cover per-resource filters, package-gallery preview metadata, and scope-aware deduplication between global and project package entries
- Latest development checkpoint:
  - Pi continues to add release- and docs-level improvements around extension hooks, package update flows, package-manager compatibility, and package-discovery ergonomics rather than narrowing this surface

## Product signal
Pi is one of the clearest examples of a harness that treats reusable workflow packaging as the product, not just as an advanced-user escape hatch.
