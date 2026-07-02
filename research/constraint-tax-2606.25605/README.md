# Constraint Tax (arXiv:2606.25605)

- Paper: **The Constraint Tax: Structured Output Degrades Tool-Calling in Open-Weight LLMs**
- Links: https://arxiv.org/abs/2606.25605 / https://huggingface.co/papers/2606.25605
- Published: 2026-06 (per arXiv listing)

## What this paper proposes

The paper measures what blanket grammar/structured-output constraints cost open-weight models. Applied globally, constrained decoding:

1. Measurably suppresses tool-calling ability (wrong tool, missing calls).
2. Degrades reasoning quality in the text surrounding structured spans.
3. Imposes a "tax" that grows with how much of the generation is constrained.

The key finding is that the tax is avoidable: applying constraints selectively — only where structure is actually required — recovers tool-calling and reasoning performance while keeping structured spans valid.

## Extracted capability to implement

### Capability name

**Emission-Point Constraint Gating (EPCG)**

### Capability definition

A decoding-mode state machine that turns grammar constraints ON only inside DSL-emission blocks and OFF for free reasoning and tool selection, driven by a policy decision table (task kind × output kind → mode).

### Why it matters in our stack

- `harness-core/src/constrainedDecoding.ts` exposes the `CONSTRAINED_DECODING_GRAMMAR_HOOK_POINT` hook; gating decides *when* that hook is armed instead of constraining whole generations.
- `agent-browser/src/services/constraintCompiler.ts` compiles per-emission constraints; the gate tells it which spans need one.
- The sibling packets `research/anka-2512.23214` (canonical grammar) and `research/token-sugar-2512.08266` (minified vocabulary) define *what* gets emitted under constraint; this packet defines *when*.

## Minimal algorithm sketch

1. Define `DecodingMode` (`free` | `constrained`) and typed generation events.
2. Encode a policy decision table mapping (task kind, output kind) to a mode.
3. Step a state machine over the scripted event sequence, consulting the table.
4. Open a constrained span on entering a DSL-emission block; close it on exit.
5. Record a deterministic trace of mode per step.
6. Assert the invariant: constraints active only inside emission spans.
7. Report span boundaries and invariant verdict.

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating EPCG in agent-browser style runtimes.
- `experiments/experiment-01-constraint-gating.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-constraint-gating.ts` — TypeScript implementation scaffold.
