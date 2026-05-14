# Production Agent Evaluation Harness (12-Metric Framework)

- Paper/article: **Building an Evaluation Harness for Production AI Agents: A 12-Metric Framework From 100+ Deployments**
- Canonical link: https://towardsdatascience.com/building-an-evaluation-harness-for-production-ai-agents-a-12-metric-framework-from-100-deployments/
- Secondary accessible source used for extraction: https://explore.n1n.ai/blog/building-evaluation-harness-production-ai-agents-2026-05-13
- Publication date: 2026-05-13

## What this paper proposes

The article proposes a production evaluation harness for agentic AI systems based on **12 metrics** grouped into four pillars:

1. Retrieval quality
2. Generation quality
3. Agentic behavior
4. Production health

The central argument is that pre-deployment benchmark scores are not enough for production agents, because real systems combine retrieval, planning, tool use, safety, and cost/latency constraints.

## Extracted capability to implement

### Capability name

**Twelve-Metric Agent Evaluation Harness (TMAEH)**

### Capability definition

A deterministic evaluation pipeline that scores each run across the four pillars and emits:

- per-metric scores,
- weighted pillar scores,
- release-gate pass/fail decisions,
- and regression deltas versus a baseline run.

### Why it matters in this repo

For `agent_harness`, this enables a reusable evaluation surface that can be run in CI and local experiments when we change prompts, tools, models, or retrieval policy.

## 12 metrics used in this implementation

### Retrieval
- `contextPrecision`
- `contextRecall`
- `contextDensity`

### Generation
- `faithfulness`
- `answerRelevance`
- `toneStyleAlignment`

### Agentic behavior
- `toolSelectionAccuracy`
- `planningEfficiency`
- `loopDetectionRate`

### Production health
- `p95LatencyMs`
- `costPerSuccessUsd`
- `guardrailViolationRate`

## Minimal algorithm sketch

1. Ingest case-level telemetry (`retrieval`, `generation`, `tool`, `trace`, `cost`, `safety`).
2. Normalize all metrics into `0..1` quality scores (lower-is-better metrics are inverted).
3. Aggregate metric averages to pillar scores.
4. Compute weighted overall score.
5. Enforce explicit release gates (minimum thresholds and hard-fail checks).
6. Compare against baseline to detect regressions.

## Deliverables in this folder

- `reference-architecture.md`
- `experiments/experiment-01-harness-spec.md`
- `experiments/experiment-01-twelve-metric-harness.ts`
