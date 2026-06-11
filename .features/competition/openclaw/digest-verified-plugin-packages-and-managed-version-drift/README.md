# Digest-Verified Plugin Packages And Managed Version Drift

- Harness: OpenClaw
- Sourced: 2026-06-11

## What it is
OpenClaw is extending ClawHub from a skill catalog into a package distribution path for code plugins and bundle plugins, with exact artifact verification, compatibility gates, dry-run publish plans, and operator-visible drift warnings for managed installs.

## Evidence
- Official docs: [ClawHub](https://docs.openclaw.ai/clawhub)
- Official changelog: [OpenClaw changelog](https://github.com/openclaw/openclaw/blob/main/CHANGELOG.md)
- First-party details:
  - ClawHub now hosts code plugins and bundle plugins alongside skills, and native `openclaw plugins install clawhub:<package>` plus `openclaw plugins update --all` keep installs tied to the registry rather than treating plugin fetch as an ad hoc npm flow.
  - package installs validate declared `pluginApi` and `minGatewayVersion` compatibility before archive install begins, so package metadata can block incompatible upgrades before runtime failure.
  - when a package version publishes a ClawPack artifact, OpenClaw prefers the exact uploaded `.tgz`, verifies both the digest header and downloaded bytes, and records artifact metadata for later updates.
  - `clawhub package publish <source> --dry-run` can render the exact publish plan without uploading, which turns package publication into an inspectable release workflow instead of a blind push.
  - the `2026.6.6` changelog adds managed plugin version-drift reporting, installed trusted-hook declarations, and dry runs that can skip publish approval, which pushes package lifecycle controls into the core harness rather than leaving them to external package managers.
- Latest development checkpoint:
  - the 2026-06-06 changelog and current ClawHub docs show OpenClaw tightening package integrity and lifecycle governance at the same time: exact artifact provenance on install, compatibility-aware updates, and explicit drift signaling after install.

## Product signal
OpenClaw is no longer treating plugin distribution as “install from a registry and hope.” It is building a managed package lane where exact artifacts, compatibility, publish intent, and post-install drift are all visible parts of the harness contract.
