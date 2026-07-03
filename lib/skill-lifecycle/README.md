# @agent-harness/skill-lifecycle

Eval-gated skill/steering self-improvement for agent_harness. This package fuses
two research scaffolds into one self-contained, dependency-free TypeScript
library:

- **Memp procedural-memory lifecycle**
  (`research/memp-2508.06433`): a `candidate -> active -> deprecated` state
  machine (promote on repeated success; deprecate on repeated failure or
  staleness) plus retrieval scoring that excludes deprecated entries.
- **SkillOpt bounded-edit eval-gate**
  (`research/skillopt-2605.23904`): bounded edit proposals accepted only when a
  validator score strictly improves, with a rejected-edit memory so failed edits
  are not retried.

Together these give a **capability**: learned skills/steering are promoted only
when they clear an evaluation gate, and skill documents are refined by
bounded, validation-gated edits.

## No dependency on `agent-browser`

This library does not import from `agent-browser` (agent-browser depends on the
libs, not vice-versa). The `PolicyGateResult` union is redeclared locally so that
`createSkillPromotionGate` returns a value **structurally compatible** with the
`SkillDefinition.policyGates` attach point in
`agent-browser/src/services/skillContracts.ts`
(`PolicyGateResult = { allowed: true } | { allowed: false; reason: string }`)
without a build-time coupling.

## Public API

Import from the package root:

```ts
import {
  // lifecycle
  transitionSkillLifecycle,
  scoreSkillRetrieval,
  DEFAULT_LIFECYCLE_THRESHOLDS,
  // eval-gate
  proposeSkillEdit,
  applySkillEdit,
  isBoundedEdit,
  optimizeSkillDoc,
  createSkillPromotionGate,
  // rng
  SeededLcg,
} from '@agent-harness/skill-lifecycle';
import type {
  SkillLifecycleState,
  SkillLifecycleEntry,
  LifecycleThresholds,
  PolicyGateResult,
  SkillEditKind,
  SkillEditProposal,
  SkillDoc,
  RejectedEdit,
  OptimizeSkillDocOptions,
  OptimizationLogRow,
} from '@agent-harness/skill-lifecycle';
```

### Lifecycle

- `transitionSkillLifecycle(entry, { success, tick }, thresholds)` — pure
  transition. Promotes `candidate -> active` on enough successes; deprecates on
  enough failures OR staleness, but never on a same-tick success.
- `scoreSkillRetrieval(entry, taskFamily)` — `0` for deprecated entries or
  task-family mismatches; otherwise the entry's success ratio (neutral `0.5`
  when there are no observed attempts).
- `DEFAULT_LIFECYCLE_THRESHOLDS` — calibrated defaults.

### Eval-gate

- `proposeSkillEdit(doc, rng, rejected)` — deterministically samples a bounded
  edit, skipping rejected keys; throws if the proposal space is exhausted.
- `applySkillEdit(doc, proposal)` — pure `replace`/`append` application.
- `isBoundedEdit(doc, proposal, maxSectionChars)` — bound check.
- `optimizeSkillDoc(doc, validate, options)` — propose -> validate ->
  accept-if-improves loop with rejected-edit memory; returns
  `{ bestDoc, accepted, rejected, log }`.
- `createSkillPromotionGate(validate, threshold)` — returns a
  `SkillDefinition.policyGate`-compatible gate that allows a candidate document
  only when `validate(candidateDoc) >= threshold`.

## Usage

```ts
import {
  optimizeSkillDoc,
  createSkillPromotionGate,
  type SkillDoc,
} from '@agent-harness/skill-lifecycle';

const seed: SkillDoc = { sections: ['Trigger: ...', 'Procedure: ...'] };
const validate = (doc: SkillDoc) => coverageScore(doc); // your evaluator

const { bestDoc } = optimizeSkillDoc(seed, validate, {
  iterations: 16,
  seed: 26052390,
  maxSectionChars: 240,
});

const gate = createSkillPromotionGate(validate, 0.9);
const decision = gate(bestDoc); // { allowed: true } | { allowed: false, reason }
```

## Phase 1 scope

Phase 1 delivers the **eval-gated skill/steering promotion capability** as a
standalone, fully tested library. Wiring it into agent-browser's
`skillRegistry` / `harnessSteering` and extending the AgentV suites to exercise
promotion/deprecation end-to-end is the documented remaining step (intentionally
out of scope for this package so that agent-browser and other packages are not
modified here).

## Local development

```sh
npm run test
npm run test:coverage
```
