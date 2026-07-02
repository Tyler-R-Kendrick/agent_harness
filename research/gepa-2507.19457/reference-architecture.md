# Reference Architecture — GEPA-style Reflective Text-Artifact Evolution

## Objective

Evolve prompt/skill/DSL-spec text with reflection-driven mutations and Pareto-frontier selection over per-instance scores, so scaffold text improves sample-efficiently without weight updates and without collapsing to a single-scalar winner.

## Components

1. **ArtifactStore**
   - Versioned, immutable text artifacts (prompts, skills, DSL specs) with parent lineage.
2. **EvalInstanceSet**
   - Fixed set of task instances; each evaluation returns one score per instance (rubric scoring per `research/rubricem-2605.10899`).
3. **TraceCollector**
   - Captures execution traces per (candidate, instance) for reflection input.
4. **ReflectiveMutator**
   - Proposes one targeted text edit from the weakest instance's trace; in production an LLM (fed by `agent-browser/src/services/selfReflection.ts` / `harnessSteering.ts`), in experiments deterministic rule-based edits.
5. **ParetoFrontier**
   - Maintains the non-dominated set over per-instance score vectors; insertion drops newly dominated members.
6. **ParentSampler**
   - Seeded sampling over frontier members so specialists on different instances all reproduce.
7. **ArtifactSafetyGate**
   - Length caps, schema checks for DSL specs, forbidden-directive scan before any candidate is evaluated.

## Data flow

1. Seed artifact is evaluated on all instances and enters the frontier.
2. ParentSampler picks a frontier member.
3. TraceCollector supplies traces for its weakest instance; ReflectiveMutator emits a child text.
4. ArtifactSafetyGate validates the child; rejected children are logged and discarded.
5. The child is evaluated on every instance to build its score vector.
6. ParetoFrontier inserts the child if non-dominated and prunes dominated members.
7. After the budget, the frontier member with best aggregate score is proposed for promotion.

## Validation and safety gates

- Every mutation passes length, schema, and policy checks before evaluation.
- Score vectors must cover all instances; partial evaluations never enter the frontier.
- The incumbent artifact is never edited in place; promotion is an explicit, reversible version bump.
- Frontier size is capped; ties beyond the cap resolve by aggregate score, deterministically.

## Rollout policy

- Start offline: evolve against a frozen eval-instance set only.
- Graduate the selected candidate to shadow mode alongside the incumbent artifact text.
- Promote only after the candidate weakly dominates the incumbent on the frozen set and matches it in shadow traffic.

## Metrics

- Aggregate score of best frontier member versus incumbent.
- Rollout efficiency (evaluations to first frontier improvement).
- Frontier size and coverage (instances on which each member is best).
- Gate rejection rate per 100 mutations.
- Regression count on previously-passing instances after promotion.
