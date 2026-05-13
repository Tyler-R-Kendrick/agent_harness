# Cross-Agent Skill Protocol With Typed Inputs And Live Sliders

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design extends the Claude Code `SKILL.md` convention with optional metadata that can generate typed intake forms, live tweak sliders, preview behavior, output manifests, and capability gating in the surrounding UI.

## Evidence
- Official spec: [skills-protocol.md](https://raw.githubusercontent.com/nexu-io/open-design/main/docs/skills-protocol.md)
- Official README: [Open Design](https://github.com/nexu-io/open-design)
- First-party details:
  - Open Design keeps base Claude Code skill compatibility and layers on an `od:` block rather than inventing a separate incompatible format
  - `od.inputs` renders typed sidebar forms instead of forcing free-text prompts for every parameter
  - `od.parameters` renders live tweakable controls after generation
  - `od.preview`, `od.outputs`, and `od.capabilities_required` define how artifacts render, export, and gate editing modes
  - the daemon can discover the same skill tree across project, repo, and user scopes and optionally symlink one canonical skill directory into multiple agent ecosystems
- Latest development checkpoint:
  - the current skills protocol and the May 2026 README still frame typed skill metadata as a load-bearing product surface, not a one-off experiment

## Product signal
Open Design is turning skills into schema-driven UI contracts, which is a stronger and more composable pattern than treating skills as opaque prompt blobs.
