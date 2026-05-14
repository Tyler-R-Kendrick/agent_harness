# Continual Harness (arXiv:2605.09998)

- Paper: **Continual Harness: Online Adaptation for Self-Improving Foundation Agents**
- Link: https://huggingface.co/papers/2605.09998
- Published: 2026-05-11 (per Hugging Face paper page)

## What this paper proposes

The paper introduces a **reset-free self-improving harness** for embodied agents that alternates between:

1. Acting in the environment.
2. Reflecting on trajectory data.
3. Refining prompts, skills/sub-agents, and memory online.

Core claim: this closes much of the gap between a minimal baseline and expert-crafted harnesses, while starting from the same raw environment interface and no curated domain scaffolding.

## Extracted capability to implement

### Capability name

**Online Harness Adaptation Loop (OHAL)**

### Capability definition

An agent runtime that can update its own operating scaffolding (instructions, tools, memory policy, and planner decomposition) during a single uninterrupted run.

### Why it matters

- Avoids the brittle "train-then-deploy static prompt" pattern.
- Lets the system learn from in-session mistakes.
- Aligns with long-horizon tasks where resets are expensive or impossible.

## Minimal algorithm sketch

1. Execute action policy for `N` steps.
2. Score trajectory chunks with process reward / heuristics.
3. Propose harness edits (prompt deltas, tool routing deltas, memory policy updates).
4. Validate edits in a safety sandbox.
5. Promote best edit to active harness.
6. Continue from current environment state (no reset).

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating OHAL into an agent system.
- `experiments/experiment-01-loop-scaffold.md` — first runnable implementation attempt spec.
- `experiments/experiment-01-reference-architecture.ts` — TypeScript reference implementation scaffold aligned with the agent-browser stack.
