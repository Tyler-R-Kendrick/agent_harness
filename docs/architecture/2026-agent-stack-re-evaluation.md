# 2026 Agent Stack Re-Evaluation

Status: Proposed (design re-evaluation; no production code changes in this change set)
Date: 2026-07-02

This document re-evaluates the entire agent_harness design against a 2026-era
target stack and the current meta-harness / self-improving-harness research
literature. It is the master document for the redesign: the companion ADRs in
`docs/adr/` record one decision each, `docs/architecture/dsl-intent-spec.md`,
`docs/architecture/nanoservice-hosting-model.md`, and
`docs/architecture/standards-adoption.md` specify the three cross-cutting
contracts, and `docs/architecture/research-integration-map.md` links the
research packets under `research/` to the decisions they inform.

## Framing: the six harness runtime responsibilities

Following the harness-design survey (arXiv:2606.20683), every execution
harness decomposes into six runtime responsibilities:

1. **Observation** — traces, telemetry, and UI surfaces that expose what the
   agent did.
2. **Context** — memory, skills, knowledge, and prompt assembly.
3. **Control** — the agent loop, routing, and orchestration policy.
4. **Action** — tool execution, code execution, constrained emission, and
   sandboxing.
5. **State** — durable workflow state, event logs, and replay.
6. **Verification** — evals, voters, completion checkers, and gates.

The re-evaluation maps every existing subsystem and every target-stack item
into one of these slots. A generated or discovered sub-harness is complete
exactly when it specifies all six.

## Target stack: verification, substitutions, and corrections

The requested stack was verified against live sources on 2026-07-02. Most
items are real and current; four names were garbled and are substituted below
with explicit callouts. Ratifying these substitutions is a review point.

### Substitutions & corrections

| Requested | Finding | Substitution used in this design |
| --- | --- | --- |
| "Vercel Workflows / Worlds SDK" | No "Worlds SDK" exists | **Vercel Workflow SDK (WDK)** — durable execution via `"use workflow"` directives (github.com/vercel/workflow) |
| "Vercel EVE" | Casing/branding | **Vercel eve** — filesystem-first agents (markdown skills + TS tools) compiled onto the WDK runtime (github.com/vercel/eve) |
| "AgentEvals.io AgentV SDK" / "Agent-Evals open industry standard" | No agentevals.io product and **no industry-standard agent-eval spec exists** | **AgentV** (agentv.dev) — already this repo's eval framework — plus OTel GenAI semantic conventions for trace shape and the Open Agent Specification (arXiv:2510.04173) as the nearest spec analogue |
| "axe-llm" | No exact match | **Ax** (`@ax-llm/ax`, the DSPy-for-TypeScript framework) as the most likely intent; alternates: `llm-axe` (Python toolkit), Deque axe (accessibility) |
| "Meta Labs' write-ahead logact agent workflows" | Not a product name | **LogAct** (arXiv:2604.07988, "Enabling Agentic Reliability via Shared Logs") — already implemented in `lib/logact`, `lib/logact-loop`, and `harness-core/src/workflow.ts` |
| "ACP" protocol | **ACP is dead** — IBM's ACP merged into A2A in August 2025 and its repo was archived | **MCP + A2A only**, both governed by the Linux Foundation Agentic AI Foundation (AAIF) |
| "SCAFFOLD.md" standard | No external standard exists | Adopted as a **repo convention** (semantic workspace map), specified in `standards-adoption.md` |

### Verified stack, mapped to responsibilities

| Stack item | What it is | Responsibility slot | Where it lands |
| --- | --- | --- | --- |
| Pi (earendil-works/pi) + Flue | Minimal four-tool agent harness + TS framework on top of it ("framework = structure, harness = the loop") | Control | Facade pattern over `harness-core` (ADR: meta-harness-runtime) |
| Ornith 1.0 (DeepReinforce) | Open-weight agentic coder that learns to generate its own scaffold; ollama-runnable | Control / Action | Second local-model tier via `ext/local-model-connector` (ADR: model-pool-and-routing) |
| OpenUI (wandb) + Vercel json-render | Describe-UI prototyping + Zod-cataloged generative-UI JSON | Observation | RendererRegistry + harness-ui widgets (ADR: meta-harness-runtime, contract only) |
| Vercel WDK | Durable execution framework | State | Adapter over LogAct workflows (ADR: durable-workflows) |
| Vercel eve | Filesystem-first agent packaging | Context / Control | `ext/` plugin pattern; maps onto workspace files + skills (ADR: meta-harness-runtime) |
| LangChain DeepAgents | Batteries-included harness: planning, subagents, virtual fs, skills | Control | Pattern source + optional `ext/` plugin; not a kernel replacement |
| NVIDIA OpenShell | Kernel-level agent sandbox with declarative YAML policies | Action | Policy-contract source for `lib/agent-sandbox` (ADR: sandbox-and-policy) |
| Microsoft Agent-Lightning | RL on execution traces, zero agent-code changes | Verification / Observation | Reward-slotted trace schema (ADR: observability-and-traces) |
| AgentV | Git-native agent eval framework | Verification | Already adopted (`agent-browser/evals/`); becomes the self-modification gate |
| OTel GenAI semconv | Trace semantic conventions | Observation | Exporter + attribute alignment (ADR: observability-and-traces) |
| llguidance | Fast grammar-constrained decoding | Action | Already vendored (`lib/llguidance-wasm`, `harness-core/src/constrainedDecoding.ts`) |
| Ax (`@ax-llm/ax`) | DSPy-style typed signatures + optimizers for TS | Control / Verification | Candidate optimizer backend for the text-space improvement loop (ADR: self-improvement-loop) |
| Ponytail / Caveman / Headroom / LLMLingua-2 / Serena / SkillOpt | Token-efficiency and code-navigation skills | Context | Techniques radar (below) + SkillOpt research packet |
| MCP + A2A | Tool protocol + agent-to-agent protocol | Action / Control | MCP client + A2A router (ADR: protocol-adoption-mcp-a2a) |
| auth.md (WorkOS), Open Knowledge Format (Google), Anthropic Agent Skills | Standards files | Context | `standards-adoption.md` |

## Subsystem disposition (keep / wrap / extend)

The headline finding of this re-evaluation: **nothing needs to be deleted or
replaced**. The repo already implements substantial parts of the target
architecture — LogAct, llguidance grammars, AgentV evals, skill routing,
plugin manifests, OTel spans — so every verdict is keep, wrap, or extend.

| Existing subsystem | Slot | Verdict | Filled by |
| --- | --- | --- | --- |
| `harness-core` (`runHarnessLoop`, `HarnessAgent`, hooks, registries) | Control | **Keep** | Pi/Flue-style facade wraps it |
| `harness-core/src/constrainedDecoding.ts` + `lib/llguidance-wasm` + `agent-browser/src/services/constraintCompiler.ts` | Action | **Keep + extend** | llguidance at DSL emission points only (Constraint Tax, arXiv:2606.25605) |
| — (gap) | Action / Control | **New (spec only)** | Two-layer intent DSL: canonical form (Anka) + `.min.map` minifier (Token Sugar) — see `dsl-intent-spec.md` |
| `harness-core/src/workflow.ts` (LogAct), `actorWorkflow.ts`, `gitWorkSaga.ts`, `lib/workgraph` | State | **Wrap** | WDK-compatible durable adapter; events/CQRS/GraphQL read models |
| `lib/logact`, `lib/logact-loop` | State | **Keep** | Already the LogAct paper; becomes the trace substrate |
| `harness-core/src/telemetry.ts` + `agentRunner.ts` spans | Observation | **Extend** | OTel GenAI exporter + reward-slotted trace schema (Agent Lightning) |
| AgentV eval suites (`agent-browser/evals/`) | Verification | **Keep** | Becomes the fitness function gating all self-modification |
| `symphonyRuntime.ts`, `harnessEvolution.ts`, `selfReflection.ts`, `harnessSteering.ts` | Control | **Wrap** | GEPA/SkillOpt/ACE text-space loop + ADAS/HGM archive with lineage |
| `skillRegistry.ts`, `skillRouter.ts`, `skillContracts.ts` (`TaskEnvelope`) | Context | **Keep + extend** | Agent Skills spec + SkillOpt trainable SKILL.md + Memp deprecation |
| `harness-core/src/memory.ts` + memory packets (`delta-mem`, …) | Context | **Keep** | ACE/Memp/Agent KB lifecycle layered on |
| Routing (`promptComplexityRouting`, `benchmarkModelRouting`, `lib/cost-aware-routing`) | Control | **Keep + extend** | Fugu-style router-over-pool endpoint; existing routing ADR governs rollout |
| Local ONNX worker + `localLanguageModel.ts` | Control | **Keep + extend** | Ornith 1.0 as a second (ollama) local tier |
| `lib/agent-sandbox` + sandbox service | Action | **Wrap** | OpenShell-style YAML policy contract over existing adapters |
| `lib/webmcp` + `lib/agent-browser-mcp` (WebMCP bridge) | Action | **Keep** | MCP client + A2A added beside it; ACP dropped (dead) |
| `PluginRegistry` + manifests (`docs/plugin-standards.md`) | all | **Keep** | DeepAgents/eve/OpenShell integrations enter as `ext/` plugins |
| `RendererRegistry` + workflow-canvas | Observation | **Keep + extend** | OpenUI/json-render-style Zod-cataloged widget catalog |
| `agent-browser/src/App.tsx` (~21.5k lines) | Shell | **Decompose (out of scope here)** | The nanoservice hosting model is the decomposition guide |

## The DSL-first operating model

The core philosophical shift this re-evaluation adopts: **models and coding
agents emit minimal intent DSLs, not raw code**. Deterministic compilers
translate intent into implementations in a framework of choice; deterministic
linters make output pretty. The full specification is
`docs/architecture/dsl-intent-spec.md`; the operating loop is:

1. **Discover** an existing purpose-built harness for the task — or emit DSL
   intent to generate one (harness archive with lineage, per ADAS/HGM).
2. **Select** a domain DSL — or emit intent to define one (canonical grammar
   registered in the grammar registry).
3. **Constrain** output to the DSL at emission points only (llguidance;
   Constraint Tax rule), in the minified vocabulary defined by the DSL's
   `.min.map`.

The same typed operator DSL doubles as the search representation the
meta-harness explores (AFlow), which is what makes harness generation
optimizable rather than free-form.

## Phased migration roadmap

Rollout follows the repo's established shadow → opt-in enforce →
core-default pattern (`agent-browser/docs/adr/2026-05-14-routing-extension-contract.md`).
Cross-subsystem sequencing: observability lands before self-improvement (the
loop needs traces and gates); the DSL spec lands before intent-mode defaults;
protocol adoption is independent.

### Phase 0 — shadow / record-only

- Create the standards files specified in `standards-adoption.md`
  (SCAFFOLD.md, MEMORY.md, STEERING.md, auth.md; OKF knowledge folder).
- Add an OTel exporter emitting GenAI-semconv spans with reward slots; no
  behavior change (`observability-and-traces` ADR).
- Register intent-DSL grammars; constraining stays disabled.
- MCP client behind a dev flag.
- Record symphony evolution runs into the harness archive with lineage; no
  gating yet.

### Phase 1 — opt-in enforce

- llguidance constraining at DSL emission points behind `intent.mode=enforce`.
- WDK-compatible durable adapter opt-in per workflow.
- SkillOpt/GEPA text-space updates land only through AgentV eval gates.
- A2A endpoint opt-in; OpenShell-style YAML policies compiled to the existing
  sandbox adapters.

### Phase 2 — core-default

- Intent DSL default for harness-generation tasks.
- Router-over-pool single endpoint default.
- Durable event-sourced workflows default, with GraphQL read models.
- Self-improvement loop continuously running under clade-metaproductivity
  gating.
- App.tsx decomposition executed against the nanoservice hosting contract.

## Techniques radar (documented, no packets)

Inference- and infrastructure-layer techniques that inform the design but do
not get research packets in this change set:

- **Speculative-Speculative Decoding** (arXiv:2603.03251) and **DeepSeek
  DSpark / DeepSpec** (June 2026): server-side inference acceleration;
  relevant to the ollama/agent-daemon tier, not the in-browser ONNX tier.
- **TurboQuant** (arXiv:2504.19874) / **Turbovec**: online vector
  quantization for the trajectory/memory retrieval indexes (Trajectory RAG,
  Agent KB) when they outgrow in-browser storage.
- **Sakana Fugu / Fugu Ultra**: router-over-model-pool as a single endpoint —
  the north star for the model-pool-and-routing ADR; routing internals are
  proprietary, so the repo keeps its own cost-aware router.
- **Trajectory RAG** (technique family: ExpeL, Agent Workflow Memory):
  retrieval over past trajectories keyed by task; enters through the Memp and
  Agent Lightning packets' trace substrate.
- **Headroom / LLMLingua-2 / Caveman** (input-side, prompt, and output-side
  compression) and **Ponytail** (minimal-code bias): context-budget policies
  layered on `lib/prompt-budget`; complementary to — not a substitute for —
  the `.min.map` DSL minification, which is deterministic and reversible.
- **Serena**: LSP-grade semantic code retrieval as an MCP server; a candidate
  default MCP client connection once the MCP client lands.

## Review points

1. Ratify the substitutions table above.
2. Defaults taken without explicit confirmation: all 10 research packets
   included; root `DESIGN.md` kept as-is (UI design system) with the gap
   documented in `standards-adoption.md`; standards files specified but not
   created here.
3. `docs/adr/` at the repo root is a new convention (precedent existed only
   under `agent-browser/docs/adr/`).
4. Post-cutoff arXiv IDs (2605.x, 2606.x, 2512.x) were captured from live web
   research; packet READMEs record canonical links.
