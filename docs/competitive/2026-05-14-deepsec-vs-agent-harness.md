# Competitive analysis: `vercel-labs/deepsec` vs `agent_harness`

_Date: May 14, 2026_

## 1) Executive summary

`deepsec` and `agent_harness` are adjacent but not direct substitutes:

- **deepsec** is a **security-vulnerability scanning pipeline** for large repositories, optimized for expensive/high-reasoning AI analysis, persistent per-file scan state, resumability, and distributed execution on Vercel Sandbox.
- **agent_harness** is a **workspace-centric browser/desktop agent UX platform** (with agent-browser as the primary app), focused on user-facing multi-workspace interaction, in-browser execution surfaces, skill/plugin extensibility, and experiment velocity.

The biggest competitive overlap is in **agent orchestration + extensibility + AI-backed automation**, not in end-user product category.

## 2) Source baseline used

### deepsec (`vercel-labs/deepsec`)
- `README.md`
- `docs/architecture.md`
- `docs/models.md`
- `docs/plugins.md`

### this repository (`agent_harness`)
- `README.md`
- `agent-browser/docs/features.md`
- `AGENTS.md`

## 3) Product positioning diff

| Dimension | deepsec | agent_harness | Net diff |
|---|---|---|---|
| Primary job | Find and process code vulnerabilities at repository scale | Provide an interactive agent workspace/runtime (chat, browser overlays, terminal, files, project switching) | Different product categories; low direct replacement risk |
| Primary users | Security teams, appsec/platform engineering | Agent UX builders, research/prototyping teams, plugin/skill authors | Distinct buying center |
| Core artifact | Findings pipeline + reports/exports | Interactive workspace experience + agent runtime + extension surfaces | deepsec outputs security findings; agent_harness outputs user workflow + runtime behaviors |
| Cost posture | Explicitly accepts high model cost for quality scans | Built around interactive product iteration and local/browser execution patterns | deepsec is batch-analysis heavy; agent_harness is UX/runtime heavy |

## 4) Feature-by-feature diff analysis

## 4.1 Pipeline architecture

**deepsec strengths**
- Clear multi-stage vulnerability pipeline: `scan -> process -> revalidate -> enrich -> export/report/metrics`.
- Stages are idempotent and resumable with additive merge behavior.
- Per-file record model plus lock semantics for parallel workers.

**agent_harness status**
- No equivalent first-class security scanning pipeline in core docs.
- Strong interactive surfaces (chat, page overlay, workspace files, terminal mode) but not packaged as security-analysis stages.

**Competitive implication**
- deepsec currently wins decisively on productionized AppSec workflow mechanics.
- agent_harness can only compete here by adding a dedicated scanner/triage/revalidation workflow layer (likely as plugin or first-class package).

## 4.2 Scale and execution model

**deepsec strengths**
- Designed for large codebases with parallel fan-out and checkpointed progress.
- Optional distributed microVM execution on Vercel Sandbox.
- Clear operational expectation for long/high-cost runs.

**agent_harness status**
- Emphasis on in-browser `just-bash`, workspace-isolated virtual filesystems, and interactive sessions.
- Strong for exploratory and per-workspace tasks; less explicit for long-running fleet-scale repo audits.

**Competitive implication**
- deepsec is stronger for enterprise-scale periodic scans.
- agent_harness is stronger for live operator-in-the-loop workflows and UX-led research loops.

## 4.3 Security-analysis depth

**deepsec strengths**
- Purpose-built finding lifecycle (candidate matching, investigation, false-positive revalidation, enrichment).
- Structured handling of model refusals and reinvestigation strategy.
- Native reporting/metrics/export pipeline for downstream review.

**agent_harness status**
- Provides general agent interaction capabilities (chat agents, AI pointer, sandbox execution, project contexts).
- No documented native vulnerability taxonomy/revalidation lifecycle analogous to deepsec.

**Competitive implication**
- For “find vulnerabilities in codebase X,” deepsec has clear functional moat today.

## 4.4 Extensibility architecture

**deepsec strengths**
- Focused plugin slots for matchers/notifiers/ownership/people/executor (+ agent references).
- Clear precedence behavior (e.g., matcher slug override).

**agent_harness strengths**
- Broader extension surface through bundled skills, extension manifests, and workspace/plugin discovery UX.
- Better positioned for heterogeneous agent UX augmentation beyond security.

**Competitive implication**
- deepsec extensibility is domain-specific (AppSec pipeline augmentations).
- agent_harness extensibility is platform-general (UX/runtime capabilities).

## 4.5 UX & operator experience

**deepsec strengths**
- CLI-first deterministic workflow suited for CI or controlled reviews.
- Explicit diff-mode and batch command model for reproducibility.

**agent_harness strengths**
- Rich visual interaction model: workspace switching, page overlays, chat panel, project-scoped state, file editing surfaces.
- Better affordances for iterative human-agent collaboration in real time.

**Competitive implication**
- deepsec wins CI/security workflow ergonomics.
- agent_harness wins interactive product UX ergonomics.

## 4.6 Model/backend strategy

**deepsec strengths**
- Opinionated default model/backend choices tuned per stage.
- Documents pricing/refusal behavior and run economics.
- Dual backend strategy (Codex + Claude) with explicit per-command model controls.

**agent_harness status**
- Multi-agent runtime behavior and local model install flow are product strengths.
- Less centrally documented around scan economics and structured security-stage model policy.

**Competitive implication**
- deepsec has stronger “operational AI for AppSec” framing.
- agent_harness has stronger “user-facing agent experience” framing.

## 5) Design philosophy diff

| Design axis | deepsec | agent_harness |
|---|---|---|
| Primary interface | CLI pipeline | Visual workspace shell + chat-centric UI |
| Data model center | Persistent per-file analysis records under `.deepsec/data/*` | Workspace-scoped tabs/files/terminal/chat/session state |
| Reliability pattern | Idempotent stage reruns + lock-based concurrency + resumability | Isolated workspaces and deterministic repo validation scripts for app evolution |
| Human loop | Review findings/reports and triage output | Real-time agent collaboration via chat, overlays, and workspace tools |
| Security posture emphasis | Vulnerability detection lifecycle | Safe browser sandboxing and isolated session execution surfaces |

## 6) Gap matrix (where deepsec is ahead vs where we are ahead)

## 6.1 deepsec leads (material)

1. End-to-end vulnerability lifecycle with explicit revalidation semantics.
2. Built-in large-repo parallelization and resumable pipeline semantics.
3. Security-specific data schemas and findings exports ready for operational review.
4. Domain-focused plugin contracts for ownership/notifiers/executor.

## 6.2 agent_harness leads (material)

1. Interactive, workspace-native UX for human-agent collaboration.
2. Multi-surface experience (chat, browser overlay, terminal mode, files) in one shell.
3. Rich skill ecosystem orientation and broader experimentation platform.
4. Product-ready concepts for per-workspace isolation and stateful session navigation.

## 7) Strategic opportunities for agent_harness

## 7.1 Build “Security Workspace” as a first-class package

Create a dedicated security-analysis package that maps deepsec-like stages into agent_harness semantics:
- Candidate discovery
- Investigation batches
- Revalidation loop
- Ownership/enrichment
- Findings board/report export

## 7.2 Leverage existing UX advantage

Implement vulnerability workflows as visual primitives:
- Diff-aware findings timeline
- Workspace tabs bound to findings and code evidence
- One-click reinvestigation with alternate model/backend
- Confidence and refusal badges integrated into session history

## 7.3 Add domain plugin contracts (security-specific)

Complement generic extension model with focused contracts:
- Matcher provider
- Ownership resolver
- Notification sink
- Evidence serializer
- Policy gate provider (for PR merge criteria)

## 7.4 Operationalize scale paths

Bridge interactive mode with batch scale:
- “Run at scale” control that dispatches background workers
- Persistent run metadata store with resumable checkpoints
- Deterministic run replay artifacts (inputs/model/version/output hashes)

## 8) Risks and watchpoints

1. **Category drift risk**: competing head-on with deepsec in pure scanner performance could dilute agent_harness’s UX/platform differentiation.
2. **Complexity risk**: adding a security pipeline without strict schemas will produce non-reproducible findings.
3. **Cost risk**: if deep analysis modes are added, cost controls and refusal handling must be explicit from day one.
4. **Trust risk**: security users require deterministic auditability, not only conversational convenience.

## 9) Recommended action plan (90-day)

1. **Weeks 1–2:** define internal security data schema (finding, evidence, verdict, revalidation history).
2. **Weeks 3–5:** ship an MVP “Security Workspace” with manual candidate import + investigation + report export.
3. **Weeks 6–8:** add plugin contracts for ownership + notifications + matcher providers.
4. **Weeks 9–10:** add batch orchestration and resumable checkpoints.
5. **Weeks 11–12:** run comparative benchmark against deepsec on two representative repos; publish precision/recall + operator-time metrics.

## 10) Bottom line

- **deepsec** is currently the stronger solution for high-scale, production-minded vulnerability scanning pipelines.
- **agent_harness** is currently the stronger solution for interactive, multi-surface agent UX and rapid experimentation.
- The best competitive path is not clone-for-clone parity; it is to combine agent_harness’s UX/runtime strengths with a narrowly scoped, auditable security workflow layer.
