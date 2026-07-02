# Reference Architecture — SkillOpt-style Eval-Gated Skill Document Optimization

## Objective

Optimize SKILL.md documents as trainable artifacts of a frozen agent runtime, with bounded edits, held-out validation gating every acceptance, and deterministic logs so any accepted document can be reproduced and audited.

## Components

1. **SkillDocStore**
   - Loads/serializes a skill document as a typed section list (`SkillDoc`), following the repo's `skills/<name>/SKILL.md` convention.
2. **RolloutReflector**
   - Runs the current document on training tasks and turns failures into edit intents.
3. **EditProposer**
   - Emits one bounded `EditProposal` per iteration: replace or append a single section, under per-section and whole-document length caps.
4. **RejectedEditMemory**
   - Stores rejected proposals with their score deltas; the proposer consults it to skip or down-rank previously failed edits.
5. **HeldOutValidator**
   - Scores a candidate document against a fixed held-out fixture task set; the only authority for acceptance.
6. **AcceptanceGate**
   - Accepts a candidate only if its held-out score strictly beats `bestDoc`; otherwise routes the proposal to RejectedEditMemory.
7. **OptimizationLedger**
   - Append-only log of proposals, scores, accept/reject decisions; emits the final `best_skill.md`.

## Data flow

1. SkillDocStore loads the seed document; HeldOutValidator scores it as the initial `bestDoc`.
2. Each iteration, RolloutReflector and EditProposer produce a bounded proposal.
3. RejectedEditMemory filters the proposal; blocked proposals are replaced by the next candidate.
4. The proposal is applied to `bestDoc` to form a candidate document.
5. HeldOutValidator scores the candidate; AcceptanceGate compares against the best score.
6. Accepted candidates become the new `bestDoc`; rejections are appended to memory with their deltas.
7. At budget exhaustion, the ledger emits `best_skill.md` plus the optimization log for registration via `skillRegistry.ts`.

## Validation and safety gates

- Every edit must be bounded: exactly one section touched, section and document length caps enforced before validation.
- No candidate replaces `bestDoc` without a strict held-out score improvement; ties reject.
- Required sections (name, trigger description) may not be deleted or emptied by any proposal.
- Validation tasks are disjoint from the rollout/reflection tasks to prevent overfitting the document to its training set.

## Rollout policy

- Start offline: optimize a copy of the skill, review the emitted `best_skill.md` diff by hand.
- Graduate to shadow deployment: register the optimized skill under a variant name in `skillRegistry.ts` and compare routing outcomes via `skillRouter.ts`.
- Enable in-place replacement of the canonical `skills/<name>/SKILL.md` only after shadow metrics clear the gate.

## Metrics

- Held-out validation score of `bestDoc` vs iteration count.
- Acceptance rate and rejected-edit memory size.
- Proposal-skip rate attributable to rejected-edit memory (wasted-eval savings).
- Document length trajectory (must stay within the 300-2,000-token band).
- Regression count on the fixture task set after each accepted edit.
