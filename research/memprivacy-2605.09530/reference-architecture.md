# Reference Architecture: Typed Reversible Privacy Envelope (TRPE)

## Goal

Implement a production-amenable memory privacy boundary for edge-cloud agents that:

- prevents raw sensitive values from leaving device boundaries,
- preserves semantic structure for memory utility,
- supports policy-based privacy levels (PL1–PL4), and
- is deterministic/auditable.

## Architecture overview

```text
┌──────────────────────────────────────────────────────────┐
│ User Interaction Layer                                   │
│ (chat input/output)                                      │
└───────────────┬──────────────────────────────────────────┘
                │ plaintext in/out
┌───────────────▼──────────────────────────────────────────┐
│ Edge Privacy Envelope (local-only)                       │
│ - Span detector/classifier                               │
│ - Placeholder allocator (typed)                          │
│ - Local mapping store (secure)                           │
│ - Restore engine                                          │
└───────────────┬──────────────────────────────────────────┘
                │ placeholderized payload
┌───────────────▼──────────────────────────────────────────┐
│ Cloud Agent + Memory Runtime                             │
│ - Planner/reasoner                                       │
│ - Memory extraction and retrieval                        │
│ - Long-term memory store                                 │
└───────────────┬──────────────────────────────────────────┘
                │ placeholderized response
┌───────────────▼──────────────────────────────────────────┐
│ Edge Restore + Policy Retention Guard                    │
│ - Placeholder decode                                     │
│ - PL4 zero-retention cleanup                             │
└──────────────────────────────────────────────────────────┘
```

## Components

### 1) Privacy Taxonomy Policy

- PL1: low sensitivity (usually retainable)
- PL2: identifiable PII (mask in cloud by default)
- PL3: highly sensitive (must be masked)
- PL4: critical secrets (must be masked + no persistence)

### 2) Span Detection + Classification

A deterministic first-pass detector (regex/rules) with optional model-assisted extractor can output:

- span indices,
- canonical privacy type (Email, Real_Name, Health_Info, Recovery_Code...),
- privacy level.

### 3) Placeholder Allocation

Generate placeholders with monotonic counters by type:

- `alice@example.com` -> `<Email_1>`
- `RC-7291` -> `<Recovery_Code_1>`

### 4) Local Mapping Store

Device-local store (in-memory or encrypted SQLite) holding:

- placeholder,
- original value,
- type,
- privacy level,
- lifecycle state.

### 5) Cloud Memory Interface

All cloud-bound memory artifacts consume only placeholderized content. This isolates raw sensitive values from cloud logs and memory stores.

### 6) Restore + Lifecycle Guard

On downlink, restore values for UX continuity. Then apply lifecycle rules:

- keep PL2/PL3 based on configured retention,
- immediately purge PL4 mappings.

## Safety/validation gates

- **Leak gate**: block outbound payload if any high-risk regex remains unmasked.
- **Policy gate**: reject unsupported privacy levels/types.
- **Consistency gate**: one-to-one mapping between placeholder and original.
- **Retention gate**: verify PL4 mappings are removed post-response.

## Rollout policy

1. Shadow mode: generate placeholders but do not mutate outbound payload; record metrics.
2. Canary mode: enable masking for PL4 only.
3. Incremental mode: enable PL3 then PL2 masking.
4. Full mode: enforce configured threshold globally.

## Metrics

- Leakage rate: unmasked sensitive spans per 1k turns.
- Utility retention: downstream memory QA delta vs plaintext baseline.
- Latency overhead: edge processing p50/p95.
- Restore fidelity: exact match rate after round-trip.
- Policy compliance: PL4 zero-retention pass rate.
