# Reference Architecture: Twelve-Metric Agent Evaluation Harness

## Overview

This architecture defines a deterministic evaluation layer around agent-browser style runs.

```text
Scenario Set / Golden Dataset
          |
          v
 Run Executor (model + tools + retriever)
          |
          v
 Telemetry Normalizer (typed run artifact)
          |
          v
 Metric Engines (12 metrics)
          |
          v
 Aggregator + Gates + Regression Comparator
          |
          v
 CI report + release decision
```

## Components

1. **Golden Dataset Store**
   - Holds representative scenarios with expected tool paths and success criteria.
2. **Run Executor Adapter**
   - Executes each scenario and captures trace-level outputs.
3. **Telemetry Normalizer**
   - Converts raw traces to stable, typed records for metric computation.
4. **Metric Engines**
   - Stateless calculators for each of the 12 metrics.
5. **Aggregator**
   - Computes pillar and overall scores.
6. **Gate Engine**
   - Enforces thresholds for deployment readiness.
7. **Regression Comparator**
   - Detects score drops vs baseline.

## Data flow

1. Select experiment configuration (model, prompt set, retrieval strategy).
2. Replay golden dataset.
3. Persist per-case traces.
4. Compute per-case metrics.
5. Aggregate to metric/pillar/overall reports.
6. Apply release gates and regression checks.
7. Export JSON for CI.

## Validation gates

Recommended gate examples:

- `faithfulness >= 0.95`
- `toolSelectionAccuracy >= 0.90`
- `guardrailViolationRate <= 0.01`
- `p95LatencyMs <= 5000`
- No single pillar drops by more than `0.03` vs baseline.

## Rollout policy

- **Canary**: Require all hard gates pass and overall score non-regressing.
- **Full rollout**: Require canary pass on 3 consecutive runs.
- **Rollback**: Trigger if guardrail violations spike or loop rate exceeds threshold.
