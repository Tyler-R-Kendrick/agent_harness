# Summary Diff For Linear Feature Generation

Updated: 2026-06-01
Baseline: `.features/Summary.md` refreshed through the 2026-05-31 Warp corpus.
Diff type: additive updates after the 2026-06-01 OpenClaw refresh

## Net new normalized features

### Added: Install-time skill provenance cards and security scan gates
- Why now: the refreshed OpenClaw corpus shows the competitive skill layer moving from "install a prompt bundle" toward "inspect a governed package with a trust envelope, provenance card, and scan state before install."
- Research delta:
  - OpenClaw now exposes `openclaw skills verify <slug>` trust envelopes and can print a generated Skill Card with `--card`
  - installed ClawHub skills verify against recorded source metadata in `.clawhub/origin.json` instead of relying on an untracked local folder
  - ClawHub skill pages expose the latest security scan state before install and link to scanner detail pages for VirusTotal, ClawScan, and static analysis
  - verification can fail closed when ClawHub marks a skill unsafe, while publishers are expected to recover false positives through a rescan flow
  - generated skill-card files are treated as metadata rather than executable prompt instructions, which keeps trust evidence separate from agent behavior
  - the June 1 OpenClaw product notes position Skill Cards and SkillSpector-style scanning as part of the public product story rather than a buried registry implementation detail

## Expanded normalized features

### Expanded: Operator control consoles with blocked-state queues and durable usage ledgers
- Why now: OpenClaw has extended its operator console into a card-backed Workboard layer where sessions, tasks, proofs, and dispatchable worker runs are all visible from the same dashboard surface.
- Research delta:
  - OpenClaw's bundled Workboard plugin adds a local Kanban surface that tracks linked task, run, session, source, proof, artifact, and diagnostics metadata per card
  - cards can directly start task-backed Codex or Claude runs, or open linked manual sessions without losing the board state
  - Workboard dispatch is Gateway-local and uses the normal subagent runtime plus background-task ledger instead of ad hoc OS process spawning
  - the same board can be driven from the dashboard, CLI, slash commands, and board-aware agent tools, which turns the operator console into a durable task-routing layer rather than a read-only monitoring surface

## Linear-ready feature payloads

### Proposed Linear feature: Add skill provenance cards and preinstall security scan gates
- Linear issue title:
  - `Add skill provenance cards and preinstall security scan gates`
- Suggested problem statement:
  - `agent-browser` already has reusable skills and plugin-like extensions, but it still asks users to trust installable workflow packages without a first-class provenance surface. Competitors are starting to show package origin, version, scanner results, and a human-readable capability card before install, and they keep that trust metadata separate from the package instructions themselves. Without an explicit trust layer, teams cannot safely adopt shared skills at scale, security review becomes manual and ad hoc, and operator overrides are hard to audit. The product needs an install-time trust surface that makes provenance, scanner results, and policy gates visible before any skill or plugin becomes runnable.`
- One-shot instruction for an LLM:
  - Implement install-time trust surfaces for `agent-browser` skills and plugins: generate a provenance card for each package that summarizes source, publisher, version, capabilities, required permissions, and linked assets; store source metadata with each installed package so later verification is deterministic; run configurable security scanners before install and show the latest scanner verdicts with drill-down detail; fail closed on blocked verification states unless an authorized operator grants an override; keep trust metadata separate from executable instructions or prompt bodies; and add review plus rescan hooks so operators can inspect, approve, or revoke installable workflows without deleting the underlying package ecosystem.
