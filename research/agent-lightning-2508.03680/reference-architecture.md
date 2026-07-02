# Reference Architecture — Reward-Slotted Trace Schema (Agent Lightning style)

## Objective

Record agent executions as OTel-compatible spans with explicit reward slots so the harness becomes RL-trainable later without refactoring, while the same traces keep serving replay, reflection, and trajectory retrieval today.

## Components

1. **SpanRecorder**
   - Thin wrapper over `withHarnessTelemetrySpan` (`harness-core/src/telemetry.ts`) emitting `TraceSpan` records with GenAI-semconv-style attributes.
2. **RewardAnnotator**
   - Writes reward slots onto spans: per-span process rewards and one episode-level reward sourced from AgentV eval verdicts.
3. **TraceStore**
   - Append-only span log layered on `lib/logact` / `lib/logact-loop`; the existing agent log becomes the trace substrate.
4. **TransitionConverter**
   - Deterministic `toTransitions()` mapping a span log to RL transitions (state / action / reward / next-state).
5. **CreditAssigner**
   - LightningRL-style hierarchical credit assignment: per-span rewards where present, episode reward propagated to the terminal model-call transition.
6. **ServingBridge**
   - OpenAI-compatible endpoint abstraction so a retrained model swaps in behind the unchanged agent.
7. **SchemaGate**
   - Validates span shape, parent linkage, reward slot ranges, and redaction policy before spans enter the store.

## Data flow

1. Agent code runs unchanged; SpanRecorder captures model calls and tool calls as spans.
2. RewardAnnotator attaches reward slots (episode reward arrives after AgentV evals score the run).
3. TraceStore appends spans to the logact-backed log.
4. TransitionConverter sorts model-call spans by start time and folds tool-call spans into the next observation.
5. CreditAssigner fills each transition's reward field.
6. Transitions feed the training server (future) and reflection/retrieval consumers (today).
7. ServingBridge exposes the updated model to the agent behind the same endpoint.

## Validation and safety gates

- SchemaGate rejects spans missing kind, timing, or parent linkage; malformed spans never reach the store.
- Reward slots must be finite and bounded; unscored episodes convert with zero reward rather than failing.
- Conversion is pure and deterministic: identical span logs always yield identical transitions (replay safety).
- Prompt/output attributes pass the harness redaction policy before persistence.

## Rollout policy

- Start in record-only mode: spans and reward slots logged, no training consumer.
- Graduate to conversion mode: transitions generated and checked against replay assertions in CI.
- Enable training mode only after transition-level metrics are stable across two eval cycles.

## Metrics

- Span capture coverage (fraction of model/tool calls recorded).
- Conversion determinism (hash-stable transitions across replays).
- Reward slot fill rate per episode.
- Transition count per episode versus model-call count (must match).
- Downstream: windowed eval reward once training mode is enabled.
