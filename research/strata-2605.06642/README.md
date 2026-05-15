# StraTA (arXiv:2605.06642)

- Paper: **StraTA: Incentivizing Agentic Reinforcement Learning with Strategic Trajectory Abstraction**
- Link: https://huggingface.co/papers/2605.06642
- Published: 2026-05-07 (per Hugging Face paper page)

## What this paper proposes

StraTA introduces an explicit trajectory-level strategy variable for long-horizon agentic RL. Instead of purely reactive, step-by-step action selection, the agent:

1. Samples a compact natural-language strategy from the initial state.
2. Conditions all downstream actions on that strategy.
3. Jointly optimizes strategy generation + step execution with hierarchical rollouts.

The paper reports stronger sample efficiency and final task performance on ALFWorld, WebShop, and SciWorld.

## Extracted capability to implement

### Capability name

**Strategic Trajectory Conditioning (STC)**

### Capability definition

A runtime loop where an agent samples a short plan/strategy once per episode (or adaptation window), conditions action generation on it, periodically critiques strategy quality, and can resample strategy when online metrics degrade.

### Why it matters in our stack

- Separates high-level intent from low-level actions in the agent-browser execution model.
- Improves credit assignment because outcomes can be attributed to both strategy and action policies.
- Provides a clean insertion point for reflection/memory systems already used by our TypeScript harness flows.

## Minimal algorithm sketch

1. Observe initial task context.
2. Generate `k` strategy candidates.
3. Execute each candidate for a short rollout budget.
4. Score with success/cost/process signals.
5. Select active strategy and continue execution conditioned on it.
6. Every `N` steps, run critical self-judgment:
   - keep strategy,
   - refine strategy text,
   - or resample.
7. Log strategy/action traces for replay and offline analysis.

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating STC in agent-browser style runtimes.
- `experiments/experiment-01-strategy-loop.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-strategy-loop.ts` — TypeScript implementation scaffold.
