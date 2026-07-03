# ADR: Durable Workflows via Event-Sourced CQRS over LogAct

## Status
Proposed

## Decision
Evolve the existing LogAct workflow stack (`harness-core/src/workflow.ts`,
`actorWorkflow.ts`, `gitWorkSaga.ts`, `lib/workgraph`) toward event-sourced
CQRS with a Vercel WDK-compatible durable-execution adapter. Developers
interact through three surfaces regardless of language or framework: send
actor commands, produce actor events, and read GraphQL materialized views.

## Contract
- The LogAct shared log (`lib/logact`, `lib/logact-loop`; arXiv:2604.07988)
  is the write-ahead substrate: actions are logged before execution,
  enabling replay, recovery, and pre-execution voters.
- Command side: typed actor commands dispatched through
  `runActorWorkflow` / `AgentLoopActorRegistry`
  (`harness-core/src/actorWorkflow.ts`, `eventLoop.ts`).
- Event side: append-only events on `agentBus`
  (`harness-core/src/agentBus.ts`) and `WorkflowAgentBus`.
- Read side: materialized views projected from the event log, exposed as a
  GraphQL schema (projection definitions are data, not code).
- Durability adapter: `"use workflow"`-style semantics (suspend for
  arbitrary durations, survive restarts) implemented over the serializable
  agent-loop state machine (`SerializableAgentLoopDefinition`), with WDK as
  the reference adapter target for server-hosted deployments.
- Workflow definitions are intent-DSL documents
  (see `2026-07-02-dsl-intent-layer.md`), making them searchable by the
  meta-harness (AFlow-style typed operator graphs,
  `research/aflow-2410.10762`).

## Rollout phases
1. **Phase 0 (shadow):** existing workflows additionally journal
   commands/events in the CQRS shape; no read models yet.
2. **Phase 1 (opt-in):** durable adapter opt-in per workflow; GraphQL read
   models served for opted-in workflows.
3. **Phase 2 (core-default):** event-sourced durable execution is the
   default for multi-step agent workflows.

## Migration notes
- `lib/workgraph` (`WorkGraphCommand`) already models command-shaped
  mutation; the CQRS contract formalizes rather than replaces it.
- Browser-only deployments keep the in-memory/IndexedDB log; the WDK adapter
  is for server-hosted continuation of the same workflow definitions.
