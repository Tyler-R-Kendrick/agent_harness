# NadirClaw Cost-Aware LLM Routing (2026-05-10)

- **Title:** How to Build a Cost-Aware LLM Routing System with NadirClaw Using Local Prompt Classification and Gemini Model Switching
- **Canonical article:** https://www.marktechpost.com/2026/05/10/how-to-build-a-cost-aware-llm-routing-system-with-nadirclaw-using-local-prompt-classification-and-gemini-model-switching/
- **Project reference:** https://github.com/NadirRouter/NadirClaw
- **Publication date:** 2026-05-10

## What this proposes

The technique introduces a local, OpenAI-compatible routing proxy that classifies prompt complexity before model dispatch. The router sends simple prompts to low-cost models and escalates complex/agentic prompts to stronger models. The core mechanism uses local embedding-based classification with latency low enough to place on the critical path.

## Extracted capability for our stack

Implement an **agent-browser cost-aware routing adapter** with:

1. Local prompt complexity classification (deterministic rule and score path).
2. Tiered model routing policy (cheap/balanced/premium).
3. Session pinning and fallback logic to reduce context fragmentation.
4. Telemetry surfaces for cost, route decisions, and fallback reasons.

This matters because agent-browser runs mixed workloads (simple edits, searches, and complex planning). A single premium model over-serves many requests and drives avoidable cost.

## Algorithm sketch

1. Compute route features from request content and execution context (prompt length, tool-intent hints, code/task markers, prior failure state).
2. Produce a complexity score from weighted features and policy thresholds.
3. Apply safety guardrails (force premium on high-risk or explicit reasoning markers).
4. Select target model tier and resolve provider/model candidate chain.
5. Execute model call with fallback escalation if latency/error thresholds trip.
6. Record telemetry (`route_decision`, `estimated_cost`, `actual_cost`, `fallback_reason`).

## Included artifacts

- `reference-architecture.md` — integration design for agent-browser.
- `experiments/experiment-01-cost-routing-sim.md` — experiment protocol and acceptance criteria.
- `experiments/experiment-01-routing-scaffold.ts` — TypeScript scaffold implementing classifier + routing loop.
