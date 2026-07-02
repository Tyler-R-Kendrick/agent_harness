# Agent Lightning (arXiv:2508.03680)

- Paper: **Agent Lightning: Train ANY AI Agents with Reinforcement Learning** — Luo et al., Microsoft Research
- Links: https://arxiv.org/abs/2508.03680 / https://huggingface.co/papers/2508.03680
- Published: 2025-08 (arXiv, August 2025)

## What this paper proposes

Agent Lightning fully decouples agent execution from RL training. Instead of rewriting the agent as a training loop, the agent keeps running wherever it lives (LangChain, AutoGen, OpenAI Agents SDK, or fully custom code — near-zero code changes) while a separate training server consumes standardized execution traces:

1. Agent runs are recorded as traces and formulated as an MDP (states, actions, rewards) via a unified trace interface.
2. **LightningRL** performs hierarchical credit assignment, decomposing arbitrary multi-turn / multi-agent trajectories into per-model-call training transitions.
3. The updated model is served back to the unchanged agent behind an OpenAI-compatible endpoint.

The paper reports stable reward improvement across text-to-SQL, retrieval-augmented generation, and math tool-use agents.

## Extracted capability to implement

### Capability name

**Reward-Slotted Trace Schema (RSTS)**

### Capability definition

An OTel-compatible span schema whose spans carry explicit reward slots, plus a deterministic converter from span logs to RL transitions (state / action / reward / next-state). Traces recorded today make the harness RL-trainable later without refactoring; the same traces also feed reflection loops and trajectory retrieval.

### Why it matters in our stack

- `harness-core/src/telemetry.ts` (`withHarnessTelemetrySpan`) is currently OTel-API-only with no exporter — adding reward slots to the span attributes is the cheapest possible on-ramp to trainability.
- `lib/logact` and `lib/logact-loop` already give us an append-only agent log; that log is the natural trace substrate for the converter.
- AgentV eval verdicts become the episode-level reward source, so evals and training share one signal.
- Complements `research/lambda-hermes-agent-reasoning-traces-2026-05` (reasoning traces) and `research/production-agent-eval-harness-12-metrics` (eval metrics) by defining the storage contract both can target.

## Minimal algorithm sketch

1. Record every model call and tool call as a span (name, spanId/parentSpanId, start/end, GenAI-semconv-style attributes).
2. Attach reward slots: optional per-span reward, plus one episode-level reward from evals.
3. Sort model-call spans by start time; fold tool-call spans into the observation of the next model call.
4. Emit one transition per model call: state = accumulated context, action = model output.
5. Assign credit hierarchically: per-span rewards where present, episode reward on the terminal transition.
6. Assert transition count, ordering, and terminal flag deterministically; hand transitions to the trainer (or replay/reflection).

## Deliverables in this folder

- `reference-architecture.md` — architecture for reward-slotted tracing in agent-browser style runtimes.
- `experiments/experiment-01-trace-to-transitions.md` — experiment design and acceptance criteria.
- `experiments/experiment-01-trace-to-transitions.ts` — TypeScript implementation scaffold.
