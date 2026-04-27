# logact

Shared-log primitives for building LogAct-style agents in TypeScript.

This package implements the core pieces described by the LogAct paper: an append-only `IAgentBus`, a `LogActAgent` loop that writes every decision to that log, quorum evaluation helpers, voter implementations, and introspection utilities for reading execution history back out of the bus.

## Public Entry Point

Import from the package root:

```ts
import {
  AllowlistVoter,
  ClassicVoter,
  InMemoryAgentBus,
  LLMPassiveVoter,
  LogActAgent,
  PayloadType,
  QuorumPolicy,
  buildExecutionSummary,
  evaluateQuorum,
  getAbortedIntents,
  getResults,
} from 'logact';
```

The package exports TypeScript source directly through `src/index.ts`. Consumers should treat the package root as the public API and avoid deep-importing `src/*.ts`.

## Main Components

- `InMemoryAgentBus`: append-only shared log with `append`, `read`, `tail`, and blocking `poll`.
- `LogActAgent`: driver, voter, decider, executor, and optional completion-check loop over the shared log.
- `ClassicVoter`, `AllowlistVoter`, `LLMPassiveVoter`: starter voter implementations for rule-based and model-based approval.
- `evaluateQuorum`: commit/abort/pending decision helper for `on_by_default`, `first_voter`, `boolean_and`, and `boolean_or`.
- `buildExecutionSummary`, `getResults`, `getAbortedIntents`: introspection helpers for audits, debugging, and recovery flows.

## Minimal Example

```ts
import {
  AllowlistVoter,
  InMemoryAgentBus,
  LogActAgent,
  QuorumPolicy,
  buildExecutionSummary,
  getResults,
} from 'logact';

const bus = new InMemoryAgentBus();

const agent = new LogActAgent({
  bus,
  inferenceClient: {
    async infer(messages) {
      const lastMessage = messages.at(-1)?.content ?? '';
      return `echo:${lastMessage}`;
    },
  },
  voters: [new AllowlistVoter('echo-policy', ['echo:'])],
  quorumPolicy: QuorumPolicy.BooleanAnd,
  executor: {
    tier: 'llm-active',
    async execute(action) {
      return action.replace(/^echo:/, '');
    },
  },
  maxTurns: 1,
});

await agent.send('hello');
await agent.run();

const results = await getResults(bus);
const summary = await buildExecutionSummary(bus);

console.log(results[0]?.output);
console.log(summary);
```

Expected behavior:

- The initial mail message is appended to the bus.
- The inference client proposes `echo:hello`.
- The allowlist voter approves that intent.
- The executor strips the prefix and records `hello` as the result.
- `maxTurns: 1` keeps the demo bounded to a single driver-vote-execute cycle.

## Notes and Constraints

- `InMemoryAgentBus` is useful for tests, demos, and local prototypes. It is not a durable persistence layer.
- `LogActAgent` uses a no-op executor by default, so production callers should usually provide an executor that dispatches tools or other side effects.
- `LLMPassiveVoter` treats a response starting with `APPROVE` as approval and any other response as rejection.
- `buildExecutionSummary` intentionally omits raw `InfIn`, `InfOut`, and `Policy` entries to keep summaries concise.

## Local Validation

Run package checks from this directory:

```sh
npm run test
npm run test:coverage
```

`vitest.config.ts` enforces 100% lines, branches, functions, and statements coverage for the package source files.
