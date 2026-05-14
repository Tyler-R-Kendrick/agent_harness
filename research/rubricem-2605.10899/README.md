# RubricEM (arXiv:2605.10899)

- Paper: **RubricEM: Meta-RL with Rubric-guided Policy Decomposition beyond Verifiable Rewards**
- Link: https://huggingface.co/papers/2605.10899
- Published: 2026-05-11 (per Hugging Face paper page)

## What this paper proposes

RubricEM proposes a rubric-guided reinforcement learning framework for long-horizon deep-research agents where rewards are not directly verifiable. It combines:

1. **Stage-aware policy decomposition** (planning, evidence gathering, review, synthesis).
2. **Stage-Structured GRPO** for denser stage-level credit assignment.
3. **Reflection-based meta-policy evolution** that distills judged trajectories into reusable guidance.

Core claim: using rubrics as a shared structure for execution, judgment, and memory improves long-form research quality and optimization stability.

## Extracted capability to implement

### Capability name

**Rubric-Guided Stage Runtime (RGSR)**

### Capability definition

A runtime loop that decomposes each task into rubric stages, evaluates stage outcomes, and updates a meta-policy memory object that conditions future attempts.

### Why it matters for our stack

- Fits `agent-browser` workflows where multi-step research requires process quality, not only final-answer correctness.
- Produces structured trajectory artifacts that can power evals and future policy updates.
- Enables safer adaptation because updates happen through typed rubric stages and validator gates.

## Minimal algorithm sketch

1. Generate or load stage rubric for current task.
2. Execute stage policies sequentially with explicit stage context.
3. Score each stage output against rubric dimensions.
4. Aggregate stage signals into trajectory credit (Stage-Structured GRPO proxy).
5. Produce reflection notes and update meta-policy memory.
6. Re-run future tasks with updated stage guidance.

## Deliverables in this folder

- `reference-architecture.md` — integration design for rubric-guided runtime + meta-policy updates.
- `experiments/experiment-01-stage-loop.md` — experiment spec and acceptance criteria.
- `experiments/experiment-01-rubricem-scaffold.ts` — TypeScript scaffold for stage runtime, scoring, and reflection memory updates.
