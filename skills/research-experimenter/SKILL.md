---
name: research-experimenter
description: Create and maintain paper research packets in this repo with the required research/<paper>/ layout, architecture docs, and experiment implementations aligned to the agent-browser TypeScript stack. Use this whenever the user asks to add a paper, summarize research, create experiment plans, or implement a paper capability as a reference architecture.
---

# Research Experimenter

Use this skill to produce consistent, implementation-ready research artifacts.

## Required repository structure

For each paper/topic:

1. Create `research/<slug>-<paper-id>/`
2. Include:
   - `README.md` (paper summary, extracted capability, algorithm sketch)
   - `reference-architecture.md` (system design, components, integration plan)
   - `experiments/` (implementation attempts and experiment logs)

Keep `research/README.md` updated with the new paper folder.

## Stack and implementation rules

- Prefer **TypeScript** for experiments and reference implementations.
- Model experiments after agent-browser conventions: typed interfaces, modular components, and deterministic execution paths.
- Do not default to Python unless the user explicitly asks for Python.

## Workflow

1. **Paper intake**
   - Capture title, canonical link, and publication date.
   - Write a short "what this paper proposes" section.
2. **Capability extraction**
   - Define one concrete capability to implement.
   - Explain why it matters and where it fits the product/runtime.
3. **Reference architecture**
   - Describe components, data flow, safety/validation gates, rollout policy, and metrics.
4. **Experiment design**
   - Add at least one experiment spec in `experiments/` with hypothesis, setup, procedure, acceptance criteria, and artifacts.
5. **Implementation attempt**
   - Add a TypeScript scaffold demonstrating the architecture in code.
   - Include strongly typed interfaces and minimal runnable loop logic where practical.
6. **Validation**
   - Run the smallest deterministic checks that prove the scaffold compiles/lints (for example, `npx tsc --noEmit` when applicable).

## Output checklist

Before finalizing, confirm:

- Folder created under `research/`.
- `README.md`, `reference-architecture.md`, and `experiments/` exist.
- At least one TypeScript implementation scaffold exists in `experiments/`.
- `research/README.md` includes the paper folder.
