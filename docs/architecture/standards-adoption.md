# Standards Adoption

Status: Proposed
Date: 2026-07-02

This document specifies the default standards files and formats the repo
adopts. The files themselves are created in migration Phase 0
(`docs/architecture/2026-agent-stack-re-evaluation.md`), not in this change
set — root standards files actively steer runtime agents, so creating them
is a behavior change, not documentation.

## File standards

### SCAFFOLD.md — semantic workspace map (repo convention)

No external standard exists; adopted as a repo convention. A root
`SCAFFOLD.md` gives semantic descriptions of workspace folders and files —
what each directory is *for*, not just what it contains — so agents can
orient without crawling. Content contract: one entry per top-level directory
plus load-bearing files; each entry states purpose, ownership, and the
conventions that apply inside. Generated skeleton should be derived from the
existing `README.md` package index and kept in sync by a checked-in script.

### MEMORY.md — basic LLM memory

Root-level durable memory file for agents operating on this repo: stable
facts, corrections, and decisions that should survive across sessions.
Precedent exists at feature scope
(`reference_impl/browser-research/dns-ad-blocking/MEMORY.md`). Contract:
append-mostly bullets grouped by topic; delta updates, never full rewrites
(ACE, arXiv:2510.04618); stale entries deprecated, not deleted silently
(Memp lifecycle, `research/memp-2508.06433`).

### AGENTS.md — agent instructions (exists)

Already present and load-bearing. Gap analysis: it mixes operating rules,
validation policy, and scaffolding conventions; once SCAFFOLD.md and
STEERING.md exist, their content moves out of AGENTS.md, which keeps only
operating instructions.

### STEERING.md — generalized reasoning-strategy corrections

Repo-level steering rules: corrections to *how* agents should reason
(strategy-level guidance), distinct from AGENTS.md's operating rules.
Precedent: `reference_impl/browser-research/STEERING-SUMMARY.md` and the
`Steering` chat agent + `harnessSteering.ts` service. Contract: numbered
rules with rationale; each rule is an optimizable artifact under the
eval-gated text-space improvement loop
(`docs/adr/2026-07-02-self-improvement-loop.md`).

### DESIGN.md — collision resolved: keep as-is

The root `DESIGN.md` is the Agent Browser **UI design system** (compact,
Material-inspired IDE rules) and stays unchanged. The "Google-style design
doc" standard the target stack names is a different artifact: per-feature
engineering design docs. Those live under `docs/architecture/` (this doc
set is the first instance); no rename is performed. If a per-feature design
standard file is later wanted, it should be `docs/architecture/DESIGN-DOCS.md`
rather than colliding with the root file.

### auth.md — WorkOS standard (real, adopted)

The auth.md open protocol (workos.com/auth-md): a Markdown file at
`/auth.md` plus OAuth Protected Resource Metadata telling agents how to
register and authenticate with a service. Adoption is two-sided: (a) any
hosted deployment of this project serves an `auth.md`; (b) the MCP/A2A
client (`docs/adr/2026-07-02-protocol-adoption-mcp-a2a.md`) reads peers'
auth.md files during connection setup. Secrets stay in the host secret
store (`harness-core/src/secrets.ts`).

### Open Knowledge Format — Google standard (real, adopted)

OKF (GoogleCloudPlatform/knowledge-catalog): markdown + YAML frontmatter
(only required field: `type`) for packaging curated knowledge so any agent
can consume it without an SDK. Adoption: workspace knowledge files and the
persistent memory graph's exportable snapshots
(`persistentMemoryGraph.ts`) serialize to OKF; research packet READMEs are
OKF-upgradeable by adding frontmatter.

### Agent Skills — Anthropic standard (real, largely adopted)

The Agent Skills spec (agentskills.io): a skill is a folder with SKILL.md
(YAML frontmatter `name` + `description`) plus optional resources, loaded
via progressive disclosure. The repo already complies: canonical skills
under `skills/<name>/` with `.claude/skills` and `.agents/skills` symlinks
(AGENTS.md rules). Gap: runtime skills registered via
`skillRegistry.ts`/`skillDefinitions.ts` should round-trip to spec-shaped
folders so SkillOpt-style optimization (`research/skillopt-2605.23904`)
operates on the standard artifact.

### Agent evals — AgentV (correction: no industry standard exists)

The requested "Agent-Evals open industry standard with AgentV as reference
implementation" does not exist as a standard. AgentV (agentv.dev) is a real
framework and is already this repo's eval system (`agent-browser/evals/`,
`EVAL.yaml` manifests, graders, runners). Adopted position: AgentV manifests
are the repo's eval format; trace shape follows OTel GenAI semconv; the
Open Agent Specification (arXiv:2510.04173) is tracked as the nearest
emerging spec.

## Protocol standards

MCP (agent↔tool) and A2A (agent↔agent), both under the Linux Foundation
Agentic AI Foundation. ACP is retired — merged into A2A in August 2025.
Details: `docs/adr/2026-07-02-protocol-adoption-mcp-a2a.md`.

## Phase 0 creation checklist (follow-up work, not this change set)

1. `SCAFFOLD.md` — generated from the package index, then hand-annotated.
2. `MEMORY.md` — seeded empty with section headers and lifecycle rules.
3. `STEERING.md` — seeded from AGENTS.md's reasoning-strategy content.
4. `auth.md` — for hosted deployments (vercel.json surface).
5. OKF frontmatter on new knowledge artifacts.
6. AGENTS.md slimmed to operating rules; links to the new files.
