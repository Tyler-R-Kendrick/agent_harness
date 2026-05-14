# Reference Architecture: Dynamic Skill Router with Composite Execution (DSR-CE)

## Goal

Implement a production-ready routing core that supports modular skills, composite workflows, and deterministic fallback behavior.

## Architecture overview

```text
┌───────────────────────────────────────────────────────────────┐
│ Task Intake                                                    │
│ - user prompt / system request / automation task              │
└───────────────────┬───────────────────────────────────────────┘
                    │ TaskEnvelope
┌───────────────────▼───────────────────────────────────────────┐
│ Routing Kernel                                                 │
│ - Eligibility Filter (schema + policy)                        │
│ - Ranker (intent/output/context scoring)                      │
│ - Tie-break + deterministic fallback                          │
└───────────────┬───────────────────────────┬───────────────────┘
                │ selected skill            │ routing traces
┌───────────────▼──────────────────┐   ┌────▼────────────────────┐
│ Skill Runtime                     │   │ Telemetry Bus            │
│ - Atomic skills                   │   │ - per-step events        │
│ - Composite skills                │   │ - latency + success      │
│ - Shared context memory snapshot  │   │ - route rationale        │
└───────────────┬──────────────────┘   └────┬────────────────────┘
                │ outputs                     │
┌───────────────▼───────────────────────────────────────────────┐
│ Evaluation + Policy Gates                                      │
│ - completion checks                                             │
│ - safety constraints                                            │
│ - quality thresholds                                            │
└─────────────────────────────────────────────────────────────────┘
```

## Components

1. **Skill Contract Layer**
   - `SkillDefinition<Input, Output>` with metadata, schema tags, and execution method.
2. **Registry**
   - Adds/removes skills, lists by category, and resolves by id.
3. **Router**
   - Deterministic scorer producing `RoutingDecision` with auditable reasons.
4. **Composite Executor**
   - Allows a skill to call child skills through the same router/registry.
5. **Telemetry Collector**
   - Captures selected skill, alternatives, latency, and completion status.

## Safety/validation gates

- Eligibility filter blocks skills failing input constraints.
- Max-step guard prevents infinite composite recursion.
- Deterministic fallback skill executes when confidence below threshold.
- All decisions include reason codes for postmortem analysis.

## Rollout policy

1. **Phase 1:** deterministic lexical/policy scoring only.
2. **Phase 2:** add model-assisted scoring in shadow mode while keeping deterministic executor authoritative.
3. **Phase 3:** conditional promotion to hybrid routing based on route-accuracy and latency SLOs.

## Metrics

- Route hit-rate against oracle labels.
- Task success rate.
- Median and P95 latency per skill.
- Fallback rate.
- Composite depth distribution.
