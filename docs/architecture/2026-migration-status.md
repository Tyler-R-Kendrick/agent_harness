# 2026 Agent-Stack Migration — Delivery Status & Core-Default Gate

Status ledger for the phased migration defined in
[`2026-agent-stack-re-evaluation.md`](./2026-agent-stack-re-evaluation.md)
(§ *Phased migration roadmap*). It tracks what has shipped through the repo's
established **shadow → opt-in enforce → core-default** discipline
(`agent-browser/docs/adr/2026-05-14-routing-extension-contract.md`), and — for
each Phase 2 `core-default` item — records the precise blocker that keeps it
gated and the exact seam where the default flip lands once that blocker clears.

This is the artifact of the **Phase 2 core-default pass**: a decision gate, not
a wholesale flag-flip. The pass evaluates every default, flips the ones that are
genuinely safe (additive, no new data source, inert when unconfigured), and
leaves the rest opt-in with an explicit unblock condition. Faking a default-on
for an integration whose data source does not yet exist would violate the repo's
"no silent caps / honest reporting" ethos — so those defaults stay gated and
named here rather than silently flipped.

## Delivery by ADR

Legend — **Shadow**: record-only, no behavior change. **Opt-in**: built +
flag-gated, default off. **Core-default**: on by default. ✅ done · ◐ partial ·
▫ not started.

| ADR | Shadow (Phase 0) | Opt-in (Phase 1) | Core-default (Phase 2) |
| --- | --- | --- | --- |
| `observability-and-traces` | ✅ `lib/harness-otel-export` (GenAI-semconv spans, reward slots) | ✅ `recordActiveHarnessReward` helper | ✅ **reached** — reward emission is unconditional & additive (no-ops without an active span); no flag, no data source |
| `self-improvement-loop` | ✅ `lib/harness-archive` (lineage record) | ◐ `harnessArchiveRecorder` (shadow record) + `lib/skill-lifecycle` (Memp lifecycle + SkillOpt eval-gate) | ▫ gated — see §1 |
| `dsl-intent-layer` | ✅ `lib/intent-dsl` (grammars registered, constraining disabled) | ◐ harness-core routes `lark` grammars through the grammar/decode hooks | ▫ gated — see §2 |
| `durable-workflows` | — | ◐ `lib/durable-workflow-adapter` over `lib/browser-durable-tasks` | ▫ gated — see §3 |
| `model-pool-and-routing` | ✅ cost-aware router (`lib/cost-aware-routing`) | ◐ `local`/Ornith tier added to the benchmark routing pool; `routerMode=enforce` gate exists | ▫ gated — see §4 |
| `sandbox-and-policy` | — | ✅ `lib/sandbox-policy` compiled to the sandbox adapters, threaded behind `VITE_SANDBOX_POLICY` | ▫ gated — see §5 |
| `protocol-adoption-mcp-a2a` | ✅ `lib/mcp-client` (dev flag) | ◐ MCP shadow discovery (`mountMcpClientShadow`) + `lib/a2a` (in-process protocol surface) | ▫ gated — see §6 |
| `meta-harness-runtime` | — | — | ▫ not started — see §7 |

Commits on the Phase 1 program branch (`claude/agent-architecture-redesign-sd4qrb`,
PR #581), each a self-contained capability + opt-in seam + documented remainder:

- Sandbox YAML policy (`lib/sandbox-policy` + opt-in threading)
- Wire merged Phase 0 libs (reward emission + archive record + MCP shadow)
- Benchmark routing `local`/Ornith tier
- Durable workflow adapter (`lib/durable-workflow-adapter`)
- Route `lark` grammars through the plugin hooks (harness-core)
- Eval-gated skill lifecycle (`lib/skill-lifecycle`)
- In-process A2A protocol surface (`lib/a2a`)

## Core-default readiness — per Phase 2 item

Each Phase 2 default from the master-doc roadmap, with its blocker and the seam
where the flip happens. The **unblock** column is the concrete, testable
condition; until it holds, the default stays opt-in.

### 1. Self-improvement loop, continuously running under clade-metaproductivity gating

- **Shipped:** `lib/harness-archive` records evolution runs with lineage;
  `harnessArchiveRecorder` records genomes (shadow, fail-open); `lib/skill-lifecycle`
  provides the `candidate→active→deprecated` Memp lifecycle, retrieval scoring
  that excludes deprecated entries, and the SkillOpt bounded-edit eval-gate
  (`createSkillPromotionGate` → `PolicyGateResult`, structurally compatible with
  `agent-browser`'s `SkillDefinition.policyGates`).
- **Blocker:** the gate and lifecycle libraries are unwired into the live
  `skillRegistry`/`createHarnessSteeringCorrection` path; archive recording is
  shadow-only (no clade-gated *promotion* consumes it yet); there is no
  continuous driver loop.
- **Unblock / seam:** attach `createSkillPromotionGate` to `SkillDefinition.policyGates`
  in `skillRouter`; feed lifecycle state into `skillRegistry` retrieval; add a
  clade-metaproductivity gate around `buildHarnessEvolutionPlan` that reads the
  archive lineage. Depends on real AgentV `EVAL.yaml` gates existing for the
  candidate skills (`workspace-self-reflection-agent`, `symphony-self-improvement`).

### 2. Intent DSL default for harness-generation tasks

- **Shipped:** `lib/intent-dsl` (canonical grammar, `.min.map` minifier, inert
  grammar-registration plugin); harness-core now routes `lark`+`intentDomain`
  `ConstrainedDecoding` through the grammar/decode hook points (previously `lark`
  compiled inline, bypassing hooks).
- **Blocker:** the app inference interface (`IInferenceClient.infer`) carries no
  constrained-decoding option; the plugin is not registered into a live
  `HookRegistry`; there is no `intent.mode` config; `llguidance-wasm` is not
  wired for the browser/ONNX tier.
- **Unblock / seam:** thread a `constrainedDecoding` option onto `infer`; register
  `createIntentDslGrammarPlugin` into the runtime `HookRegistry`; add an
  `intent.mode` enum to the SettingsRegistry + `STORAGE_KEYS`; wire `llguidance-wasm`.
  Default flips to `intent.mode=enforce` for harness-generation tasks once the
  browser tier can actually constrain.

### 3. Durable event-sourced workflows default, with GraphQL read models

- **Shipped:** `lib/durable-workflow-adapter` — `runDurable` over
  `lib/browser-durable-tasks` (Dexie/IndexedDB runtime: define → enqueue → tick).
- **Blocker:** unwired into `runLogActActorWorkflow`/`runActorWorkflow`; the open
  risk is suspend/resume of a *live tool loop*. GraphQL read models and WDK are
  server-tier, out of the browser scope.
- **Unblock / seam:** opt-in per workflow via `SerializableAgentLoopDefinition`,
  soak the suspend/resume path under eval, then flip the default. GraphQL read
  models tracked separately at the server tier.

### 4. Router-over-pool single endpoint default

- **Shipped:** `local`/Ornith provider tier added to `buildBenchmarkRoutingCandidates`;
  `isBenchmarkModelRef` accepts `local`; the `routerMode=enforce` gate already
  flips models across the ghcp+ONNX pool.
- **Blocker:** the Ornith/`local-model-connector` tier is an inert stub — no real
  models are registered — so defaulting router-enforce would route to an empty
  tier. Per-workspace opt-in exists; it is not the default.
- **Unblock / seam:** register real models into `ext/provider/local-model-connector`;
  validate the pool under the cost-routing eval; flip `routerMode` default to
  `enforce` once the pool is non-empty and eval-validated.

### 5. Sandbox YAML policy default

- **Shipped:** `lib/sandbox-policy` (parse YAML/JSON, compile to
  `BrowserSandboxOptions`/`RunLimits`/`NetworkPolicy`/permissions, report
  `unsupportedDirectives`); threaded into `createSandboxExecutionService` behind
  `VITE_SANDBOX_POLICY`, fail-open.
- **Blocker:** there is no policy **source** — no authoring UI and no convention
  for where a workspace's `.sandbox/policy.yaml` comes from. Flag-on today only
  adds an fs read + fail-open warning per run.
- **Unblock / seam:** add policy authoring/selection UI (or a repo convention
  that guarantees the doc exists); once a policy source is real, flip
  `VITE_SANDBOX_POLICY` on by default so compiled limits apply.

### 6. Protocol adoption (MCP client default connection; A2A endpoint)

- **Shipped:** `lib/mcp-client`; `mountMcpClientShadow` (log-only tool discovery,
  closes the bridge in `finally`); `lib/a2a` (AgentCard build/validate + never-throw
  router with sequential `compose`).
- **Blocker:** MCP shadow is behind `mcpClientEnabled` with no server-config UI
  (`.mcp/servers.json` must be authored by hand); A2A is greenfield with no
  browser host seam — agent cards derive from the still-unbuilt meta-harness
  descriptor, and the endpoint realistically lands at the server tier
  (`agent-daemon`/dev middleware).
- **Unblock / seam:** add MCP server-config UI, then promote shadow → active tool
  mount (a candidate default connection is Serena as an LSP-grade MCP server);
  host `createA2ARouter` behind a dev-middleware endpoint once the meta-harness
  descriptor exists.

### 7. App.tsx decomposition against the nanoservice hosting contract

- **Status:** not started. This is a large refactor of the ~21.5k-line `App.tsx`
  against `nanoservice-hosting-model.md`, not a flag flip; it is sequenced after
  the integration seams above are wired, so the extracted nanoservices have
  stable contracts to target.

## Summary

- **Core-default reached:** observability reward emission (additive, unconditional).
- **Opt-in, ready to flip once its data source exists:** sandbox YAML policy,
  durable workflow adapter.
- **Opt-in, needs further integration before flip:** intent-DSL enforce, router
  enforce over a real pool, self-improvement gating, MCP active mount, A2A host.
- **Not started:** App.tsx nanoservice decomposition.

The migration is complete through **Phase 1 (opt-in enforce)** across all eight
ADRs that have an enforceable browser-tier surface. Phase 2 default-flips are
gated on the enumerated blockers above rather than forced prematurely; each entry
names the exact seam so the flip is a small, reviewable change when its
precondition holds.
