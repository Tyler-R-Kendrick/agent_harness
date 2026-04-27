# logact

LogAct agentic reliability primitives backed by a shared append-only agent log.

## Public entry point

Import from the package root:

```ts
import {
  InMemoryAgentBus,
  LogActAgent,
  PayloadType,
  QuorumPolicy,
  evaluateQuorum,
} from 'logact';
```

The package exposes a single public entry point declared in [`package.json`](./package.json). Do not deep-import `src/*`; internal file paths are not a stable contract.

## What it provides

- `InMemoryAgentBus`: append-only log implementation for local agent workflows.
- `LogActAgent`: driver/decider loop that records inference, intent, vote, commit, abort, result, and completion entries.
- Voters: `ClassicVoter`, `AllowlistVoter`, and `LLMPassiveVoter`.
- Quorum helpers: `evaluateQuorum` and `QuorumPolicy`.
- Introspection helpers: `buildExecutionSummary`, `getResults`, and `getAbortedIntents`.
- Shared payload and component contracts exported as TypeScript types.

## Minimal example

```ts
import {
  InMemoryAgentBus,
  LogActAgent,
  PayloadType,
  QuorumPolicy,
  getResults,
} from 'logact';

const bus = new InMemoryAgentBus();
const agent = new LogActAgent({
  bus,
  inferenceClient: {
    async infer() {
      return 'say hello';
    },
  },
  executor: {
    tier: 'llm-active',
    async execute(action) {
      return `executed: ${action}`;
    },
  },
  voters: [],
  quorumPolicy: QuorumPolicy.OnByDefault,
  maxTurns: 1,
});

await agent.send('hello');
await agent.run();

const entries = await bus.read(0, await bus.tail());
const results = getResults(entries).filter((entry) => entry.payload.type === PayloadType.Result);
```

## Package contents

Published package artifacts are limited to this README, `package.json`, and the runtime TypeScript source files under `src/`. Tests and local package configuration are excluded from the consumer artifact.

## Local development

Run package checks from this directory:

```sh
npm run test
npm run test:coverage
```
