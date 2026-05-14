# Reference Architecture — StraTA-style Strategic Trajectory Conditioning

## Objective

Integrate trajectory-level strategic abstraction into our TypeScript agent runtime while preserving deterministic logs, replayability, and safe online adaptation.

## Components

1. **TaskContextAdapter**
   - Converts environment/task state into typed context object.
2. **StrategyGenerator**
   - Produces compact strategy candidates from initial context.
3. **StrategyEvaluator**
   - Runs budgeted rollouts and scores candidates.
4. **ActionPolicy**
   - Generates actions conditioned on `(context, activeStrategy, memorySlice)`.
5. **TrajectoryLedger**
   - Append-only store of strategy/action/outcome events.
6. **CriticalJudge**
   - Periodic judge deciding keep/refine/resample.
7. **SafetyGate**
   - Enforces strategy schema, length caps, forbidden directives, and tool policy constraints.

## Data flow

1. Adapter emits `TaskContext`.
2. Generator proposes `StrategyCandidate[]`.
3. Evaluator ranks strategies and selects active candidate.
4. Action policy executes step loop with active strategy.
5. Ledger stores events.
6. Every `adaptEvery` steps, judge reads recent window and proposes `StrategyDecision`.
7. Safety gate validates; runtime applies approved decision.

## Validation and safety gates

- Strategy text must pass schema and policy checks.
- Resample/refine operations require minimum evidence threshold from recent outcomes.
- Unsafe or low-confidence updates are rejected and previous strategy is retained.

## Rollout policy

- Start in shadow mode: strategy logged but not controlling actions.
- Graduate to active mode for low-risk tasks.
- Enable adaptive mode only after passing metric gates.

## Metrics

- Success rate over task budget.
- Average action cost.
- Strategy churn rate (resamples per 100 steps).
- Time-to-recovery after failure streak.
- Policy stability (variance in windowed reward).
