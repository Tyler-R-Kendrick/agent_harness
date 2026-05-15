# SkillOS (arXiv:2605.06614)

- Paper: **SkillOS: Learning Skill Curation for Self-Evolving Agents**
- Link: https://huggingface.co/papers/2605.06614
- arXiv: https://arxiv.org/abs/2605.06614
- Published: 2026-05-07 (arXiv submission date)

## What this paper proposes

SkillOS introduces an RL-driven way to **learn skill curation policies** for self-evolving agents. Instead of hand-written heuristics for memory/skill updates, it splits the system into:

1. A **frozen executor** that solves tasks using a skill repository.
2. A **trainable curator** that edits the external skill repository from experience.

The key idea is to learn long-horizon curation from delayed feedback via:

- **Composite rewards** (effectiveness + efficiency style signals).
- **Grouped task streams** where earlier trajectories update skills and later related tasks evaluate whether those updates helped.

## Extracted capability to implement

### Capability name

**Dependency-Grouped Skill Curation Loop (DG-SCL)**

### Capability definition

A typed curation engine that processes related task streams, proposes repository skill mutations (create/update/prune/merge), and accepts only changes that improve downstream grouped-task utility under safety constraints.

### Why it matters

- Converts short-term task traces into durable reusable skills.
- Optimizes for delayed, downstream gains (not only immediate task wins).
- Fits our TypeScript agent stack where skills are markdown-like, auditable, and versioned.

## Minimal algorithm sketch

1. Run grouped tasks with current `SkillRepo` using a fixed executor.
2. Collect trajectory/process stats per task in the group.
3. Compute composite reward:
   - immediate task quality
   - execution efficiency
   - downstream transfer gain on later tasks in group
4. Curator proposes skill operations (`create`, `update`, `merge`, `prune`).
5. Validate operations (schema checks, invariants, safety policy).
6. Apply accepted operations as a new `SkillRepo` version.
7. Continue on future groups with updated repo.

## Deliverables in this folder

- `reference-architecture.md` — architecture for DG-SCL in our stack.
- `experiments/experiment-01-grouped-curation.md` — experiment spec + acceptance criteria.
- `experiments/experiment-01-skillos-scaffold.ts` — TypeScript scaffold of grouped curation with composite rewards and gated updates.
