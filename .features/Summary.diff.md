# Summary Diff For Linear Feature Generation

Updated: 2026-04-30
Baseline: `.features/Summary.md` updated from the 2026-04-30 fifteen-harness corpus.
Diff type: additive update after Space Agent research

## Net new normalized features

### Added: Mutable agent-built workspace surfaces
- Why now: Space Agent makes the strongest current case that the agent should build the workspace itself, not only fill a fixed chat transcript with answers.
- Research delta:
  - the README says the agent reshapes the interface and can build a page, tool, widget, or workflow into the running workspace
  - the product site says Space Agent builds your space right in the browser
  - recent browser-surface work makes popup and inline browser panes part of one live runtime model instead of separate UI concepts

### Expanded: Shared team agents and governance
- Why now: Space Agent adds a sharper model for user-specific layers, group-shared behavior, and admin rollback than the current summary captured.
- Research delta:
  - the README describes users building in their own layer while groups share tools and workflows across teams
  - the self-hosted surface is explicitly positioned for multi-user setups with group management
  - admin mode plus Git-backed history frames governance as a control-plane and rollback problem, not only a chat-history problem

### Expanded: Browser use and computer control
- Why now: Space Agent tightens the relationship between browser automation and the harness UI by unifying popup and inline browser surfaces.
- Research delta:
  - the `v0.64` release moves web browsing to registered browser surfaces with one API and lifecycle
  - prompt-time runtime state now reasons about currently open and last interacted browser surfaces
  - the agent can operate against browser surfaces that are part of the workspace it is also shaping

### Added: Let browser agents build persistent in-app workspace surfaces
- Why now: `agent-browser` still treats the app shell mostly as a fixed surface, while Space Agent shows the harness itself can become a task-specific artifact the agent assembles.
- Linear issue title:
  - `Let browser agents build persistent workspace surfaces`
- Suggested problem statement:
  - `agent-browser` can drive tools and browsers, but it cannot yet persistently add dashboards, widgets, guided flows, or review panels into the app as first-class outputs of the run.
- One-shot instruction for an LLM:
  - Design and implement a mutable workspace-surface system for `agent-browser` where an agent can create task-specific pages, widgets, browser panes, and review panels inside the app, persist them as named artifacts, and expose ownership, permissions, and rollback for every agent-authored surface.

### Added: Add layered team customware with rollback
- Why now: Space Agent shows a strong pattern for combining personal layers, shared group layers, and admin-safe rollback in one system.
- Linear issue title:
  - `Add layered workspace customware and rollback`
- Suggested problem statement:
  - `agent-browser` lacks a clean way for individuals and teams to publish reusable workspace behavior without risking cross-user breakage or manual cleanup when an experiment goes wrong.
- One-shot instruction for an LLM:
  - Implement layered customware for `agent-browser` with user, team, and admin scopes; let agents publish reusable tools and workflow surfaces into those scopes; and back every change with versioned history, diff inspection, and one-click rollback to the last known good state.

### Added: Unify popup and inline browser surfaces
- Why now: Space Agent's browser-surface model is a concrete reminder that browser automation becomes more composable when embedded panes and separate windows share the same runtime contract.
- Linear issue title:
  - `Unify browser panes and popup windows`
- Suggested problem statement:
  - `agent-browser` still risks fragmented UX and duplicated logic between embedded browser views and detached windows, which makes task-specific workspace composition harder to build.
- One-shot instruction for an LLM:
  - Refactor `agent-browser` so embedded browser panes and popup windows register through one browser-surface abstraction with shared lifecycle, focus semantics, state reporting, and prompt exposure, then migrate existing browser actions and UI controls onto that contract.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Let browser agents build persistent workspace surfaces`
2. `Add layered workspace customware and rollback`
3. `Unify browser panes and popup windows`
