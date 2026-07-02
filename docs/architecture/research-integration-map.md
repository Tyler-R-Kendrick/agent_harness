# Research Integration Map

Status: Reference
Date: 2026-07-02

Cross-reference of research packets to the decisions they inform. Reading
order for the redesign: master doc → ADR → the packets in its row.

| Research packet | Consuming ADR / doc | Subsystem slot |
| --- | --- | --- |
| `research/anka-2512.23214` (new) | `dsl-intent-layer` ADR, `dsl-intent-spec.md` | Action: canonical intent grammar |
| `research/token-sugar-2512.08266` (new) | `dsl-intent-layer` ADR, `dsl-intent-spec.md` | Action: `.min.map` minifier |
| `research/constraint-tax-2606.25605` (new) | `dsl-intent-layer` ADR | Action: emission-point constraint gating |
| `research/aflow-2410.10762` (new; distinct from `aaflow-2605.02162`) | `dsl-intent-layer`, `durable-workflows` ADRs | Control: operator-graph search |
| `research/gepa-2507.19457` (new) | `self-improvement-loop` ADR | Control: text-space evolution |
| `research/adas-2408.08435` (new) | `self-improvement-loop`, `meta-harness-runtime` ADRs | Control: harness archive + lineage |
| `research/hgm-2510.21614` (new) | `self-improvement-loop` ADR | Verification: clade-gated promotion |
| `research/skillopt-2605.23904` (new) | `self-improvement-loop` ADR, `standards-adoption.md` | Context: trainable SKILL.md |
| `research/agent-lightning-2508.03680` (new) | `observability-and-traces` ADR | Observation: reward-slotted traces |
| `research/memp-2508.06433` (new) | `self-improvement-loop` ADR, `standards-adoption.md` | Context: procedural memory lifecycle |
| `research/aaflow-2605.02162` (existing) | `durable-workflows` ADR | State: deterministic operator pipelines |
| `research/skillos-2605.06614`, `research/ctx2skill-2604.27660` (existing) | `self-improvement-loop` ADR | Context: skill artifacts |
| `research/continual-harness-2605.09998` (existing) | `self-improvement-loop` ADR | Control: continual harness adaptation |
| `research/rubricem-2605.10899`, `research/production-agent-eval-harness-12-metrics` (existing) | `observability-and-traces`, `self-improvement-loop` ADRs | Verification: scoring |
| `research/cost-aware-llm-routing-nadirclaw-2026-05-10` (existing; graduated to `lib/cost-aware-routing`) | `model-pool-and-routing` ADR | Control: routing |
| `research/delta-mem-2605.12357`, `research/hybrid-memory-agent-marktechpost-2026` (existing) | `self-improvement-loop` ADR | Context: memory stores |
| `research/lambda-hermes-agent-reasoning-traces-2026-05` (existing) | `observability-and-traces` ADR | Observation: reasoning traces |

Cited without packets (see master doc techniques radar and ADR texts): DSPy
2310.03714, Trace 2406.16218, harness survey 2606.20683, DGM 2505.22954,
SICA 2504.15228, AlphaEvolve 2506.13131, DemoEvolve 2605.24539, ACE
2510.04618, Agent KB 2507.06229, AWM 2409.07429, XGrammar-2 2601.04426,
CodeAgents 2507.03254, LogAct 2604.07988 (implemented in `lib/logact`).
