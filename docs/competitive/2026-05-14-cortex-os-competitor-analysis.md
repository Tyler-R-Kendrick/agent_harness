# Competitor Analysis: ArtificialMinds/Cortex-OS vs Agent Harness

_Date:_ May 14, 2026  
_Target competitor:_ https://github.com/ArtificialMinds/Cortex-OS  
_Baseline compared product:_ `agent_harness` (with `agent-browser` as primary app)

## Executive summary

Cortex-OS and Agent Harness solve different layers of the stack:

- **Cortex-OS** is a Raspberry Pi-oriented, Debian-netinstall-based IoT operating system distribution with build/flash scripts and boot-time automation.
- **Agent Harness / Agent Browser** is a browser-first agent workspace for chat, terminal simulation, workspace files, extensions, and in-browser agent workflows.

There is **limited direct product overlap**. Cortex-OS is closer to embedded Linux provisioning; Agent Harness is closer to in-browser agent UX and multi-workspace orchestration.

## Evidence collected

### Public repository metadata (GitHub API snapshot)

Collected on **May 14, 2026**:

- Repo: `ArtificialMinds/Cortex-OS`
- Description: "A Linux distribution for the Internet of Things."
- Default branch: `master`
- Stars: `3`
- Forks: `1`
- Open issues: `0`
- Primary language: `Shell`
- Created: `2015-10-06T12:39:47Z`
- Last pushed: `2017-01-13T17:39:49Z`
- Last updated metadata: `2026-05-13T21:42:08Z`
- License field: `null` (no SPDX value exposed by API)

### Public repository README and structure observations

From the repository landing page and README:

- Framed as a "Linux distribution for the Internet of Things."
- Build flow targets Raspberry Pi/compatible hardware.
- Scripted pipeline: `clean.sh`, `download.sh`, `build.sh`, `image.sh`, `flash.sh`, coordinated by `install.sh`.
- Mentions unattended install expansion from minimal image to fuller system.
- Developer extension path emphasizes adding device directories under `/src` implementing a `Device` interface.

## Current state: Agent Harness (baseline)

From this repository's root README and Agent Browser feature docs:

- Monorepo centered on **agent-oriented browser/desktop UX experimentation** with `agent-browser` as the primary runnable app.
- Agent Browser supports:
  - chat agents (`Codi`, `GHCP`),
  - local/browser model install flows,
  - in-browser terminal mode (`just-bash`) with git-stub workflows,
  - workspace/project isolation,
  - extension surface,
  - page overlays + AI pointer,
  - visual validation and verification scripts.
- Strong emphasis on deterministic validation (`verify:agent-browser`, Playwright visual smoke).

## Direct diff analysis (competitor vs current state)

## 1) Product category and scope

- **Cortex-OS:** OS distribution + device provisioning for IoT hardware.
- **Agent Harness:** Browser-native agent workspace/runtime UX.

**Diff outcome:** Orthogonal products; only adjacent in "agent-enabled workflows" narrative.

## 2) Runtime environment

- **Cortex-OS:** Runs on Raspberry Pi/embedded target hardware; relies on Linux image building/flashing.
- **Agent Harness:** Runs as web app (React/Vite) with browser-managed state and sandboxed execution surfaces.

**Diff outcome:** Different deployment assumptions (hardware OS image vs browser app session).

## 3) Developer workflow model

- **Cortex-OS:** Bash scripts for build/install/flash; host package prerequisites.
- **Agent Harness:** npm workspace scripts, Vitest, Playwright, lint/build/coverage gates.

**Diff outcome:** Harness is CI/dev-toolchain-heavy for app quality; Cortex-OS is provisioning-script-centric.

## 4) Extensibility surface

- **Cortex-OS:** Device capability extension by adding scripts/modules under `/src` aligned to connectivity lifecycle.
- **Agent Harness:** Extension manifests + bundled skills + MCP/WebMCP libraries + chat-agent routing.

**Diff outcome:** Extensibility in Harness is higher-level (agent/runtime/plugin ecosystem) versus lower-level device hooks in Cortex-OS.

## 5) Observability and quality signals

- **Cortex-OS:** README-level build docs; minimal visible quality signals in current public snapshot (small activity footprint, old last push date).
- **Agent Harness:** Explicit verification pipeline and visual smoke documentation.

**Diff outcome:** Harness currently presents a stronger visible quality/validation posture for active development.

## 6) Strategic overlap opportunities

Potential intersection areas (if ever pursued):

- Agent Harness as a control-plane UX for managing edge/IoT fleets.
- MCP or tool adapters that trigger Cortex-style image build/flash pipelines remotely.
- "Edge device workspace" abstraction in Agent Browser mapping to device lifecycle operations.

## Gaps and opportunities for Agent Harness (derived from comparison)

1. **Edge/IoT operator narrative is implicit, not explicit.**  
   Add a first-class reference architecture doc showing how Agent Browser could orchestrate real hardware lifecycle tasks.

2. **No out-of-the-box "device provisioning" workflow.**  
   Consider a plugin/eval demonstrating scripted image build, flash simulation, and post-boot checks as agent tools.

3. **Competitor-style simplicity in onboarding scripts could inspire demos.**  
   Provide a guided "single command" demo path for one vertical (e.g., local agent + browser + workspace bootstrap).

## Risk assessment

- **Competitive displacement risk (short term): Low.** Products are not direct substitutes.
- **Narrative risk:** Medium. "AI OS" messaging in the market can blur categories; ensure Agent Harness positioning is clear (agent workspace runtime, not Linux distro).
- **Technical risk from competitor momentum:** Low based on publicly visible maintenance signals as of May 14, 2026.

## Recommended actions (priority order)

1. Publish a concise **positioning one-pager** in `docs/` clarifying where Agent Harness sits relative to "AI OS" / IoT OS projects.
2. Add one **edge-integration reference plan** under `docs/superpowers/plans/` to show concrete hardware/IoT orchestration path via tools/plugins.
3. Add an eval fixture for a mock "device lifecycle" task (provision, configure, validate) to demonstrate extensibility.

## Sources

- Competitor repository page: https://github.com/ArtificialMinds/Cortex-OS
- Competitor API metadata: https://api.github.com/repos/ArtificialMinds/Cortex-OS
- Internal baseline docs used for current-state comparison:
  - `README.md`
  - `agent-browser/docs/features.md`
