# Skills Extensions Themes And Pi Packages

- Harness: Pi
- Sourced: 2026-04-30

## What it is
Pi exposes most customization through installable resources: prompt templates, skills, extensions, themes, and shareable Pi Packages that can be installed globally, per project, or ephemerally for a single run.

## Evidence
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md)
- Official package docs: [docs/packages.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md)
- First-party details:
  - the README says prompt templates expand with `/name`, skills load as `/skill:name`, themes hot-reload, and extensions can replace or augment large parts of the UI
  - package docs show install sources spanning npm, git URLs, raw GitHub URLs, and local paths
  - project-level installs live in `.pi/settings.json` and Pi auto-installs missing project packages on startup
  - `pi -e` supports temporary package installs for the current run only
- Latest development checkpoint:
  - Pi keeps adding release-level improvements around extension hooks, package update flows, and package-manager compatibility rather than narrowing this surface

## Product signal
Pi is one of the clearest examples of a harness that treats reusable workflow packaging as the product, not just as an advanced-user escape hatch.
