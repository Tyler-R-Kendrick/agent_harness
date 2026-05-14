# Reference Architecture: Reasoning Trace Intelligence Pipeline (RTIP)

## Goal

Implement an agent-browser-aligned subsystem that turns raw reasoning traces into analytics and fine-tuning assets with deterministic, typed processing.

## Components

1. **Trace Ingestion Adapter**
   - Input: JSONL / dataset API payloads from trace corpora.
   - Output: `RawTraceConversation[]`.

2. **Structured Trace Parser**
   - Tokenizes role/content blocks.
   - Classifies steps into: `reasoning`, `tool_call`, `tool_result`, `assistant_output`.

3. **Trace Analyzer**
   - Computes metrics:
     - tool calls per conversation,
     - tool success ratio,
     - average reasoning steps,
     - completion quality proxy.

4. **Visualization Projection Layer**
   - Emits chart-friendly data series:
     - step index vs action type,
     - conversation-level summary cards,
     - per-category histograms.

5. **Fine-tuning Example Builder**
   - Selects eligible conversations (passes safety + completeness checks).
   - Produces prompt/response pairs with optional tool-context blocks.

6. **Validation and Policy Gate**
   - Schema checks.
   - PII/tool-secret redaction.
   - Deterministic filtering rules for reproducibility.

## Data flow

1. Dataset pull -> ingestion adapter.
2. Adapter output -> parser.
3. Parsed traces -> analyzer + visualization projection.
4. Parsed traces + quality signals -> fine-tuning builder.
5. Exports -> eval fixtures + training bundle.

## Safety and validation gates

- Reject malformed conversations (missing roles or empty assistant outputs).
- Strip secrets from tool payloads before analytics/export.
- Disallow conversations that include policy-violating trajectories.

## Rollout plan

1. **Phase 1 (this experiment)**: in-memory scaffold with typed interfaces and deterministic transformation.
2. **Phase 2**: connect to dataset loader and store snapshots under versioned artifacts.
3. **Phase 3**: wire outputs into agent-browser eval matrix and regression checks.

## Success metrics

- Parser determinism: same input -> byte-identical output JSON.
- Coverage of expected step types >= 99% on sampled traces.
- Fine-tuning eligibility precision validated by manual review rubric.
- Zero leaked secrets in exports.
