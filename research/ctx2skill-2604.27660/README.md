# Ctx2Skill (arXiv:2604.27660)

- Paper: **From Context to Skills: Can Language Models Learn from Context Skillfully?**
- Link: https://huggingface.co/papers/2604.27660
- Published: 2026-05-05 (per Hugging Face paper page)

## What this paper proposes

Ctx2Skill proposes a **self-evolving, feedback-free skill-construction loop** for context learning. Instead of manually writing context skills or relying on execution ground truth, it runs adversarial self-play between:

1. A **Challenger** that creates tasks + rubrics from context.
2. A **Reasoner** that answers tasks using current skills.
3. A **Judge** that gives binary pass/fail via rubrics.
4. Side-specific **Proposer/Generator** agents that update Challenger/Reasoner skill sets.

It adds **Cross-time Replay** to pick the most generalizable Reasoner skill snapshot, countering adversarial collapse.

## Extracted capability to implement

### Capability name

**Context Skill Self-Play Loop (CSSL)**

### Capability definition

A deterministic orchestration loop that incrementally evolves context-specific natural-language skills through rubric-judged failures/successes, and selects the final skill snapshot via replay scoring on hard/easy probes.

### Why it matters in our stack

- Fits agent-browser-style typed orchestration without requiring model fine-tuning.
- Produces reusable skills that can be prepended to runtime prompts for the same context.
- Enables closed-model workflows where only inference APIs are available.

## Minimal algorithm sketch

1. Initialize `reasonerSkills` and `challengerSkills`.
2. Iterate `N` rounds:
   - Challenger emits `M` tasks + rubrics from context.
   - Reasoner answers with its current skills.
   - Judge marks each task solved (`all rubrics pass`) or failed.
   - Failed set updates Reasoner skills via proposer+generator.
   - Solved set updates Challenger skills via proposer+generator.
   - Add one hardest-failure probe and one easiest-success probe.
3. Replay all candidate Reasoner skill snapshots on probe sets.
4. Select snapshot maximizing `rhoHard * rhoEasy` with Laplace smoothing.

## Deliverables in this folder

- `reference-architecture.md` — architecture and integration plan for CSSL.
- `experiments/experiment-01-self-play-scaffold.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-ctx2skill-scaffold.ts` — TypeScript scaffold implementing the loop + replay selector.
