# Reference Architecture: Dependency-Grouped Skill Curation Loop (DG-SCL)

## Goal

Implement a production-leaning SkillOS-inspired subsystem that learns and applies skill curation from delayed grouped-task feedback while keeping the executor deterministic and frozen.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────────┐
│ Frozen Executor                                              │
│ - retrieves candidate skills from SkillRepo                  │
│ - solves current task without self-modifying policy internals│
└────────────────┬─────────────────────────────────────────────┘
                 │ trajectories + outcomes
┌────────────────▼─────────────────────────────────────────────┐
│ Grouped Task Stream Runner                                   │
│ - organizes tasks by dependency/topic cluster                │
│ - tags order: early tasks = adaptation context               │
│               later tasks = delayed evaluation               │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│ Curation Trainer/Policy                                      │
│ - computes composite reward                                  │
│ - proposes skill ops: create/update/merge/prune             │
└────────────────┬─────────────────────────────────────────────┘
                 │ proposals
┌────────────────▼─────────────────────────────────────────────┐
│ Validation & Safety Gate                                     │
│ - schema/format checks                                       │
│ - anti-duplication and bounded-size checks                   │
│ - policy constraints (protected skills, denylist patterns)   │
└────────────────┬─────────────────────────────────────────────┘
                 │ accepted ops
┌────────────────▼─────────────────────────────────────────────┐
│ Versioned SkillRepo                                          │
│ - immutable versions + lineage metadata                      │
│ - rollback and audit trail                                   │
└──────────────────────────────────────────────────────────────┘
```

## Components

### 1) Frozen Executor

- Reads from active skill repo version.
- Emits per-task metrics: quality score, token/call cost, latency proxy.
- No runtime changes to executor weights or prompt policy in this phase.

### 2) Grouped Task Stream Runner

- Input: task groups with explicit ordering/dependency tags.
- Early tasks generate curation signals.
- Later tasks serve as delayed transfer checks.

### 3) Curation Policy

- Consumes group trajectories and current repo snapshot.
- Produces typed `SkillOp[]` proposals.
- Reward objective emphasizes delayed transfer, not only immediate gains.

### 4) Validation & Safety Gate

Hard requirements before apply:

- skill schema valid
- op references existing ids when required
- content length bounds
- no changes to protected/core skills
- projected repo size under configured max

### 5) Versioned SkillRepo

- Copy-on-write apply model.
- Each new version stores parent version id + accepted ops + reward summary.

## Composite reward template

`R = w_q * quality + w_e * efficiency + w_t * transfer_gain - w_r * regressions`

Where:

- `quality`: normalized task success/score.
- `efficiency`: inverse cost (tokens/tools/latency proxy).
- `transfer_gain`: later-task improvement vs control snapshot.
- `regressions`: penalty for failures caused by curation.

## Rollout policy

1. Shadow evaluate proposed repo on held-out grouped stream.
2. Promote when transfer gain exceeds threshold and regressions are below cap.
3. Auto-rollback to previous version on repeated degradation.

## Success metrics

- Grouped-task average reward uplift vs static repo baseline.
- Transfer gain on later tasks per group.
- Skill reuse precision (retrieved skill relevance).
- Repo growth quality (fewer low-value/duplicate skills).
- Rollback rate and safety violations.
