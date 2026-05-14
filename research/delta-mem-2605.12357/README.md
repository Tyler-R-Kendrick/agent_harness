# δ-mem (arXiv:2605.12357)

- Paper: **δ-mem: Efficient Online Memory for Large Language Models**
- Link: https://huggingface.co/papers/2605.12357
- Canonical: https://arxiv.org/abs/2605.12357
- Published: 2026-05-12 (arXiv submission date)

## What this paper proposes

δ-mem adds a tiny, online-updated associative memory to a frozen full-attention LLM. Instead of extending context length, the model maintains a compact memory state that is updated with a delta-rule and read back as low-rank corrections to attention logits/values during generation.

The core claim is that a fixed-size memory state can provide strong long-horizon recall improvements at far lower cost than brute-force context scaling or full-model adaptation.

## Extracted capability to implement

### Capability name

**Online Delta Memory Adapter (ODMA)**

### Capability definition

A runtime memory adapter that continuously compresses interaction traces into a fixed-size state and injects learned low-rank attention corrections into the active reasoning stack.

### Why it matters in our stack

- Agent-browser sessions can span long tool trajectories where strict context budgets force truncation.
- A compact online memory can preserve task-critical facts without growing prompt size linearly.
- A deterministic adapter boundary lets us evaluate memory quality independently from base model changes.

## Minimal algorithm sketch

1. Encode each new observation/action pair into a key-value vector pair.
2. Update memory state with a delta-rule: `M <- M + η (v - M k) kᵀ`.
3. Read memory for current query to produce correction factors.
4. Project readout into low-rank attention deltas.
5. Fuse deltas into scoring/routing for next agent step.
6. Track memory utility metrics and gate unsafe regressions.

## Deliverables in this folder

- `reference-architecture.md` — architecture for integrating ODMA in the agent-browser runtime.
- `experiments/experiment-01-odma-scaffold.md` — experiment spec and acceptance criteria.
- `experiments/experiment-01-odma.ts` — TypeScript scaffold implementing the online memory update and readout loop.
