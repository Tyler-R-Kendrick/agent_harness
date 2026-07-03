# ADR: Self-Improvement Loop — Text-Space First, Archive-Based, Eval-Gated

## Status
Proposed

## Decision
Structure harness self-improvement as a text-space optimization loop
(GEPA arXiv:2507.19457, SkillOpt arXiv:2605.23904, ACE arXiv:2510.04618)
over an archive of harness variants with lineage (ADAS arXiv:2408.08435,
Darwin Gödel Machine arXiv:2505.22954), with parent selection by
clade-metaproductivity (HGM arXiv:2510.21614). Every self-modification is
gated by AgentV evals. RL (Agent-Lightning style) is a later, complementary
stage enabled by the reward-slotted traces — never the first lever.

## Contract
- Optimizable artifacts are text: SKILL.md documents, system prompts,
  steering rules, intent-DSL harness definitions, and memory playbooks.
  Edits are bounded diffs, applied via delta updates (ACE), never full
  rewrites.
- Archive: content-addressed harness/skill variants with parent lineage and
  eval scores; variants are never evolved in place. Expansion selects
  parents by clade-metaproductivity, not best-own-score.
- Gate: propose → benchmark (AgentV) → accept/reject, with rejected-edit
  feedback retained to condition future proposals (SkillOpt). Existing
  Phase-0 gates: the `symphony-self-improvement` and
  `workspace-self-reflection-agent` eval suites; if their manifests prove
  too narrow, suite extension is Phase 1 work.
- Skill lifecycle: accreted skills carry Memp-style states
  (candidate → active → deprecated; arXiv:2508.06433) enforced by
  `skillRegistry.ts` policy.
- Wrapped surfaces: `agent-browser/src/services/symphonyRuntime.ts`,
  `harnessEvolution.ts`, `selfReflection.ts`, `harnessSteering.ts`.
- Research packets: `research/gepa-2507.19457`, `research/adas-2408.08435`,
  `research/hgm-2510.21614`, `research/skillopt-2605.23904`,
  `research/memp-2508.06433`.

## Rollout phases
1. **Phase 0 (shadow):** evolution runs recorded into the archive with
   lineage and eval scores; no variant is promoted automatically.
2. **Phase 1 (opt-in):** eval-gated promotion for skills and steering rules;
   human review remains in the loop for harness-definition changes.
3. **Phase 2 (core-default):** continuous improvement loop under
   clade-metaproductivity (CMP) gating;
   RL stage may activate on the accumulated reward-slotted traces.

## Migration notes
- The archive reuses `ArtifactRegistry` storage shapes
  (`harness-core/src/artifacts.ts`) rather than a new store.
- Eval coverage bounds what self-improvement can learn; expanding AgentV
  suites is part of this loop's roadmap, not an afterthought.
