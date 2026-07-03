# @agent-harness/a2a

A minimal, self-contained **Agent-to-Agent (A2A)** protocol surface for agent_harness: an agent-card schema plus an in-process router that dispatches a task to a registered agent and returns its result.

This package has **no runtime dependencies**. The schema is defined in-repo and its field names align with the public A2A spec's `AgentCard` where reasonable, kept deliberately minimal.

## Purpose

Per the protocol-adoption ADR (`docs/adr/2026-07-02-protocol-adoption-mcp-a2a.md`), A2A is the cross-agent coordination protocol: agents are exposed as A2A endpoints and their runs are composed into chains. This library is the protocol/schema and the in-process router capability that models that composition — the "the caller composes multiple agent runs" pattern documented in `agent-browser/src/services/agentRunner.ts`.

## Public entry point

Import from the package root:

```ts
import {
  buildAgentCard,
  isA2AAgentCard,
  createA2ARouter,
  type A2AAgentCard,
  type A2ASkill,
  type A2ATaskRequest,
  type A2ATaskResult,
  type A2AAgentHandler,
  type A2ARegisteredAgent,
  type A2AComposeStep,
  type A2ARouter,
  type BuildAgentCardInput,
} from '@agent-harness/a2a';
```

## AgentCard schema

- `A2ASkill` — `{ id, name, description? }`, a capability an agent advertises.
- `A2AAgentCard` — `{ id, name, description?, version, skills, url? }`, a minimal `AgentCard`.
- `buildAgentCard(input): A2AAgentCard` — validates `id`, `name`, `version` (non-empty strings) and `skills` (an array); throws clear errors otherwise.
- `isA2AAgentCard(value): value is A2AAgentCard` — runtime type guard for untrusted values.

```ts
const card = buildAgentCard({
  id: 'researcher',
  name: 'Researcher',
  version: '1.0.0',
  skills: [{ id: 'search', name: 'Web search' }],
});
```

## Router API

`createA2ARouter(): A2ARouter` returns an in-process router:

- `register(agent: A2ARegisteredAgent): void` — register `{ card, handler }`; re-registering the same `card.id` replaces the prior agent.
- `list(): A2AAgentCard[]` — every registered agent's card.
- `getCard(agentId): A2AAgentCard | undefined` — a single card by id.
- `dispatch(agentId, request): Promise<A2ATaskResult>` — routes the task to the agent's handler. It **never throws**: an unknown agent, an unknown skill, or a handler that throws all resolve to `{ status: 'failed', error }`.
- `compose(steps): Promise<A2ATaskResult[]>` — runs steps sequentially (the agentRunner "compose multiple agent runs" chain), stopping on the first failing step and annotating that result with the step index and agent id.

```ts
const router = createA2ARouter();
router.register({ card, handler: async (req) => ({ status: 'completed', output: req.input }) });

const result = await router.dispatch('researcher', { skillId: 'search', input: 'query' });

const chain = await router.compose([
  { agentId: 'researcher', request: { skillId: 'search', input: 'a' } },
  { agentId: 'writer', request: { skillId: 'draft', input: 'b' } },
]);
```

## Scope

**Phase 1: in-process A2A router + agent-card schema; hosted A2A transport (HTTP endpoint / dev middleware, server tier) and deriving cards from the meta-harness sub-harness descriptor are the documented remaining steps.** A browser SPA has no HTTP server, so the hosted transport lands at the server tier separately.

## Local development

Run package checks from this directory:

```sh
npm run test
npm run test:coverage
```
