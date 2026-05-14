# Reference Architecture: Hybrid Memory + Tool Dispatch

## Objectives

Implement a production-oriented hybrid memory subsystem and tool dispatcher that can be integrated into our recursive research runtime.

## Components

- **EmbeddingProvider**
  - Interface for producing numeric vectors.
  - Deterministic fake provider for tests; OpenAI-backed provider for runtime.

- **HybridMemoryStore**
  - Stores memory chunks and metadata.
  - Computes sparse and dense ranks.
  - Merges rankings with Reciprocal Rank Fusion.

- **ToolRegistry**
  - Registers typed tool definitions.
  - Exposes JSON-schema-like descriptors for model tool-calling.

- **ToolDispatcher**
  - Validates requested tool name exists.
  - Executes tool handler and captures structured result.

- **Agent Loop Adapter**
  - Bridges planner/LLM decisions to tool invocations.
  - Writes tool outcomes back into memory if configured.

## Data flow

1. User/query input arrives at agent loop.
2. Loop queries `HybridMemoryStore.search(query, topK)` for grounding context.
3. Loop calls planner/LLM with context + tool schemas.
4. If tool call selected, `ToolDispatcher` executes handler.
5. Tool result is optionally persisted via `HybridMemoryStore.store(...)`.
6. Loop continues until completion criterion.

## Safety and validation gates

- Tool name allowlist enforcement through registry lookup.
- Strictly typed tool input/output surfaces.
- Guarded top-k limits and deterministic ranking logic for testability.
- No dynamic code execution in tools by default.

## Rollout policy

1. Ship as an opt-in module in `lib/recursive-research-agent` follow-up work.
2. Run eval comparisons against current memory-only baselines.
3. Promote to default only after quality + latency thresholds are met.

## Metrics

- Retrieval hit-rate on known-fact replay scenarios.
- Correct tool selection rate in multi-tool tasks.
- End-to-end answer groundedness and citation quality.
- Latency overhead from dual retrieval + fusion.
