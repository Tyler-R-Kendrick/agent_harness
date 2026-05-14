# Cost-Aware LLM Routing with NadirClaw (MarkTechPost, 2026-05-10)

- Article: **How to Build a Cost-Aware LLM Routing System with NadirClaw Using Local Prompt Classification and Gemini Model Switching**
- Link: https://www.marktechpost.com/2026/05/10/how-to-build-a-cost-aware-llm-routing-system-with-nadirclaw-using-local-prompt-classification-and-gemini-model-switching/
- Published: 2026-05-10
- Reference implementation repo: https://github.com/NadirRouter/NadirClaw

## What this article proposes

The tutorial presents a practical model-routing pattern:

1. Classify prompts locally (simple vs complex).
2. Route simple prompts to a low-cost model (for example Gemini Flash).
3. Route complex prompts to a stronger premium model (for example Gemini Pro).
4. Add fallback logic and transparent cost/performance accounting.

This pattern reduces average token cost while preserving quality on harder tasks.

## Extracted capability to implement

### Capability name

**Local Complexity Router (LCR)**

### Capability definition

A deterministic routing layer that estimates prompt complexity with local heuristics/signals and chooses between a cheap and premium model according to a policy with budget and quality guardrails.

### Why it matters in our stack

- Reduces unnecessary premium model usage in agent-browser style multi-turn workflows.
- Creates a measurable policy surface (routing thresholds, fallback behavior, confidence gates).
- Fits agent-harness architecture where routing can sit before provider invocation.

## Minimal algorithm sketch

1. Compute local prompt features (length, tool/action indicators, reasoning indicators).
2. Produce complexity score and confidence.
3. Route to `cheapModel` when score < threshold; otherwise `premiumModel`.
4. Apply fallback to premium when confidence is too low.
5. Log decision with estimated cost, confidence, and reason vector.

## Deliverables in this folder

- `reference-architecture.md` — integration design for agent-browser/agent-harness.
- `experiments/experiment-01-routing-policy.md` — experiment plan and acceptance criteria.
- `experiments/router-sim/` — TypeScript runnable policy scaffold with 100% test coverage.
