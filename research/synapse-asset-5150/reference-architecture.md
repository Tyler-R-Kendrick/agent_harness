# Reference Architecture: Graph-Based Agent Harness Loop

## Objective

Map Synapse-style graph state management into the Agent Harness stack as a deterministic orchestration runtime for chat agents and tool execution.

## Component model

1. **Graph Registry**
   - Stores versioned graph definitions (`GraphDefinition`).
   - Supports nested graph references.

2. **Node Runtime**
   - Executes typed node handlers with bounded inputs/outputs.
   - Produces `NodeResult` and optional emitted events.

3. **Transition Engine**
   - Validates candidate edges using guard predicates.
   - Picks transition using deterministic priority rules.

4. **Blackboard Store**
   - Shared state map (`Blackboard`) scoped by run/session.
   - Supports checkpoint save/load.

5. **Execution Journal**
   - Append-only history of node execution + chosen transition.
   - Powers observability, replay, and failure diagnosis.

6. **Safety Gate**
   - Enforces max steps, recursion depth, and forbidden transitions.
   - Converts unsafe conditions into dedicated recovery/error nodes.

## Data flow

1. Orchestrator loads graph + checkpoint.
2. Current node executes against blackboard.
3. Transition engine evaluates eligible outbound edges.
4. Chosen edge updates node pointer and blackboard patch.
5. Journal persists `{node,start/end,result,edge}` event.
6. Runtime repeats until terminal conditions.

## Integration plan (Agent Harness)

- Add a graph-runtime package surface under harness core loop implementation.
- Expose a graph DSL for defining nodes, guards, and nested subgraphs.
- Route agent phases (`plan`, `act`, `observe`, `recover`) through graph nodes.
- Persist blackboard snapshots in existing run artifact storage.
- Emit graph telemetry to existing runtime logs and eval traces.

## Rollout policy

1. **Shadow mode:** run graph loop in parallel with current loop, compare traces.
2. **Canary agents:** enable for one internal chat agent profile.
3. **Partial rollout:** use for planning/recovery only.
4. **Default runtime:** switch all eligible agents after eval pass.

## Metrics

- Transition validity rate (invalid edge attempts / total transitions)
- Recovery success rate
- Mean steps-to-terminal
- Resume success after forced interruption
- Determinism score (same input, same transition trace)
