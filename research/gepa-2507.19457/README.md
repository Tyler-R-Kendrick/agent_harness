---
type: research-packet
---

# GEPA (arXiv:2507.19457)

- Paper: **GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning**
- Authors: Agrawal, Khattab et al. (UC Berkeley / Stanford / Databricks / MIT)
- Link: https://arxiv.org/abs/2507.19457
- Published: 2025-07 (arXiv v1)

## What this paper proposes

GEPA (Genetic-Pareto) optimizes the *text* of prompts and scaffolds instead of model weights:

1. An LLM **reflects** on execution traces of a candidate prompt/scaffold and proposes targeted text mutations.
2. Candidates are selected on a **Pareto frontier over per-task-instance scores**, not a single scalar best-of, so specialists that excel on different instances all survive as parents.
3. The genetic loop (sample parent from frontier, mutate via reflection, evaluate, update frontier) beats GRPO by roughly 10-19% with up to 35x fewer rollouts, and also beats MIPROv2.

Headline: language-space optimization of scaffold text is far more sample-efficient than weight-space RL.

## Extracted capability to implement

### Capability name

**Reflective Text-Artifact Evolution (RTAE)**

### Capability definition

An evolution loop over text artifacts (prompts, skills, DSL specs) where mutations are proposed from reflection on execution traces, each candidate carries a per-instance score vector, and survivor selection maintains a Pareto frontier instead of keeping only the single best scalar performer.

### Why it matters in our stack

- `agent-browser/src/services/selfReflection.ts` and `harnessSteering.ts` already produce reflection signals; RTAE is the optimization loop those surfaces would drive.
- Per-instance Pareto selection pairs naturally with rubric-based scoring from `research/rubricem-2605.10899`, which supplies the score vectors.
- Skill text managed via `research/skillos-2605.06614` patterns is exactly the artifact class this loop evolves.

## Minimal algorithm sketch

1. Seed the frontier with the current artifact text, scored per eval instance.
2. Sample a parent from the frontier.
3. Reflect on its weakest instance and apply a targeted text mutation.
4. Evaluate the child on all instances to get a score vector.
5. Insert into the frontier if not dominated; drop newly dominated members.
6. Repeat for the budget; select the frontier member with the best aggregate score.

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating RTAE with our reflection surfaces.
- `experiments/experiment-01-pareto-text-evolution.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-pareto-text-evolution.ts` — TypeScript implementation scaffold.
