# Reference Architecture: Cost-Aware Local Complexity Router

## Objective

Implement a first-pass, deterministic model router that mirrors NadirClaw's core idea: classify locally, route by complexity, and keep policy observable.

## Components

1. **Prompt Feature Extractor**
   - Input: user prompt, optional session metadata.
   - Output: normalized features (`tokenEstimate`, `hasCodeIntent`, `hasReasoningIntent`, `hasToolingIntent`).

2. **Complexity Classifier (Local)**
   - Deterministic scoring function (no remote model call).
   - Outputs `score` [0..1], `tier` (`simple` | `complex`), and `confidence`.

3. **Routing Policy Engine**
   - Inputs classifier output + config.
   - Chooses `cheapModel` or `premiumModel`.
   - Applies low-confidence fallback to premium.

4. **Invocation Adapter**
   - Adapts chosen route to provider-specific request format.
   - Can target OpenAI-compatible endpoints and Gemini-style names.

5. **Observability + Cost Ledger**
   - Emits structured routing records.
   - Tracks estimated token spend avoided and confidence distribution.

## Data flow

1. Prompt arrives at `routeRequest`.
2. Feature extractor + classifier produce `RoutingDecision`.
3. Policy engine selects primary model.
4. Adapter executes model call.
5. Result and decision metadata are persisted for audit/eval.

## Safety and validation gates

- **Confidence gate:** if confidence < `minConfidence`, force premium route.
- **Keyword escalation:** security/compliance/critical prompts bypass cheap route.
- **Session pinning (optional):** stick to premium for a run after hard-task detection.

## Rollout plan

1. Shadow-mode routing (record decisions but do not switch model).
2. 10% traffic split with manual eval review.
3. Progressive ramp by domain/task type.
4. Full rollout when cost reduction target and quality floor are stable.

## Success metrics

- Cost reduction (target: 30%+ against single premium baseline).
- Quality parity on complex tasks (manual/eval win-rate >= baseline).
- Low misroute rate (`complex` tasks incorrectly sent to cheap model < threshold).
