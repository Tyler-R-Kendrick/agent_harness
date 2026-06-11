# Summary Diff For Linear Feature Generation

Updated: 2026-06-11
Baseline: `.features/Summary.md` refreshed through the 2026-06-09 GitHub Copilot corpus.
Diff type: additive updates after the 2026-06-11 OpenClaw refresh

## Net new normalized features

### Added: Registry-verified plugin package artifacts with compatibility gates and drift alerts
- Why now: the refreshed OpenClaw corpus now shows a stronger first-party package lifecycle than the earlier OpenClaw slice captured. ClawHub is no longer just a place to browse skills and scan results; it now acts as a managed registry for code plugins and bundle plugins with exact artifact verification and managed update signaling.
- Research delta:
  - current ClawHub docs now describe code-plugin and bundle-plugin hosting, native `openclaw plugins install clawhub:<package>` and `openclaw plugins update --all` flows, and package publishing with `clawhub package publish <source>`
  - package installs validate advertised `pluginApi` and `minGatewayVersion` metadata before archive install starts, which turns compatibility into an explicit install gate instead of a runtime surprise
  - when a version publishes a ClawPack artifact, OpenClaw prefers the exact uploaded `.tgz`, verifies both the digest header and downloaded bytes, and records artifact metadata for later updates
  - the same docs expose `--dry-run` publish plans, which lets plugin publishers inspect the exact package release plan before upload
  - the `2026.6.6` OpenClaw changelog adds managed plugin version-drift reporting, dry runs that can skip publish approval, and trusted-hook install declarations, pushing package lifecycle governance further into the harness core

## Expanded normalized features

### Expanded: Skills, plugins, and reusable workflow packaging
- Why now: the OpenClaw refresh shows that reusable workflow packaging is maturing from installable prompt bundles into a registry-managed package lane with exact artifacts, compatibility gates, and package-health follow-through after install.
- Research delta:
  - OpenClaw now treats plugin packages as first-class registry objects rather than leaving them in a side-channel package-manager flow
  - compatibility metadata and artifact digest verification are now part of the install contract, not just publisher conventions
  - managed version drift is surfaced by the harness itself, which extends packaging from “install once” into “keep package state governed over time”

## Linear-ready feature payloads

### Proposed Linear feature: Add registry-verified plugin package artifacts with compatibility gates and drift alerts
- Linear issue title:
  - `Add registry-verified plugin package artifacts with compatibility gates and drift alerts`
- Suggested problem statement:
  - `agent-browser` already has skills, plugins, and external tool surfaces, but it still lacks a governed package lifecycle for those extensions. Competitors are moving beyond simple marketplace install buttons: OpenClaw now validates plugin compatibility before install, prefers exact published package artifacts instead of best-effort package resolution, records artifact metadata for later updates, offers dry-run publish planning, and warns when managed plugin versions drift from the expected registry state. Without a comparable package contract, `agent-browser` cannot guarantee what extension artifact was actually installed, cannot reliably block incompatible upgrades, and cannot give operators a durable view of managed extension drift. The product needs a registry-backed package lane that treats plugin and skill artifacts as governed runtime assets rather than anonymous package-manager installs.`
- One-shot instruction for an LLM:
  - Implement a managed extension-package registry flow for `agent-browser`: support registry-hosted skill, plugin, or bundle packages with explicit compatibility metadata such as minimum runtime API and minimum app version; validate that metadata before install; prefer exact published artifacts over opportunistic package resolution; record source, version, digest, and artifact metadata for every installed package; add dry-run publish planning for package authors; and surface managed-version drift warnings plus guided update, pin, or rollback actions in the operator UI so extension lifecycle stays inspectable after install.
