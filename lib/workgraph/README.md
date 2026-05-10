# WorkGraph

WorkGraph is Agent Harness' local-first work management framework. It gives the browser a durable Linear-style work graph without depending on Linear, a backend worker, Docker, or workstation setup.

The library is event sourced:

- all mutations enter through a typed command bus;
- commands append immutable domain events;
- projections are rebuilt from events;
- React UI subscribes to projected state through `useSyncExternalStore`;
- IndexedDB is the browser persistence target through the Dexie-backed schema;
- durable tasks can be enqueued for search indexing, import/export, sync, and Symphony branch automation.

Symphony uses WorkGraph as the internal representation for generated agent subtasks. Each isolated branch is represented as a WorkGraph issue with branch metadata, validation criteria, approval metadata, and lifecycle state. The UI can still render the Symphony orchestration view, but the project/task model is reusable by plugins and agent tools instead of being embedded in the view.

## Core API

```ts
import {
  createInMemoryWorkGraphRepository,
  createWorkGraph,
  searchWorkGraph,
} from '@agent-harness/workgraph';

const graph = createWorkGraph({
  repository: createInMemoryWorkGraphRepository(),
});

await graph.dispatch({
  type: 'workspace.create',
  actor: { type: 'user', id: 'user-1' },
  payload: { name: 'Agent Harness', key: 'HAR' },
});

const snapshot = graph.getSnapshot();
const results = searchWorkGraph(snapshot, 'review gate');
```

## Validation

Run:

```powershell
npm.cmd --workspace @agent-harness/workgraph run test:coverage
```

The package enforces 100% statement, branch, function, and line coverage.
