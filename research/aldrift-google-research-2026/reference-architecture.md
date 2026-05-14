# Reference Architecture: Drift-Aware Answer Reliability Loop (DARL)

## Goal

Implement a deterministic reliability controller that prevents “sounds-right but wrong” outputs when conversation/retrieval conditions drift.

## Architecture overview

```text
User Query/Turn
      │
      ▼
Drift Classifier ──► Policy Selector ──► Answer Generator
      │                    │                    │
      │                    ▼                    ▼
      └──────────────► Verification Gates ◄────┘
                               │
                     pass      │      fail
                               ▼
                        Answer Emitter
                               │
                               ▼
                      Telemetry + Audit Log
```

## Components

### 1) Drift Classifier

Inputs:
- turn text,
- dialogue history deltas,
- retrieval source volatility metadata.

Output:
- `low | medium | high` drift severity.

### 2) Policy Selector

Maps drift severity to answer-mode constraints:
- **low**: normal synthesis,
- **medium**: stricter grounding requirement,
- **high**: mandatory verification or abstention path.

### 3) Answer Generator

Produces a candidate answer with evidence references and uncertainty estimate.

### 4) Verification Gates

Deterministic checks:
- minimum evidence count,
- contradiction marker rejection,
- uncertainty disclosure for low-confidence candidates.

### 5) Telemetry + Audit Log

Stores:
- drift severity,
- chosen policy,
- gate outcomes,
- retries/abstentions,
- latency and final confidence.

## Safety and rollout policy

- Start in shadow mode (log-only, no user-visible intervention).
- Promote to enforcement mode for high drift only.
- Expand to medium drift after stable pass-rate and reduced factual regressions.

## Metrics

- Gate failure rate by severity,
- Regeneration rate,
- Abstention quality (human-rated helpfulness),
- Post-answer correction rate,
- Time-to-first-acceptable-answer.
