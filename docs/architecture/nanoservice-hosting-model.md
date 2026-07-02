# Nanoservice Hosting Model

Status: Proposed
Date: 2026-07-02

Every component of the harness is a nanoservice: independently verifiable,
hostable anywhere — same process, Web Worker, iframe, server, or distributed
— without code changes. This document defines the hosting-neutral component
contract, the 12-factor mapping, the verification ladder, and the
durable-async developer contract.

## Hosting-neutral component contract

- A component declares: its command inputs (typed messages), its emitted
  events, its required capabilities (storage, inference, tools), and its
  policy scopes (`docs/adr/2026-07-02-sandbox-and-policy.md`).
- Components communicate only through messages and the event log — never
  through shared in-memory state — so in-process and distributed hosting are
  the same code path with different transports.
- Existing seams that already follow this shape:
  - `harness-core/src/actorWorkflow.ts` + `eventLoop.ts`
    (`AgentLoopActorRegistry`, serializable loop definitions);
  - `harness-core/src/agentBus.ts` (append-only event bus);
  - `lib/workgraph` (`WorkGraphCommand` command-shaped mutation);
  - `lib/workers/*` (`@agent-harness/worker` browser/daemon providers) and
    `docs/worker-sandbox-provider-architecture.md`;
  - `agent-browser/src/sandbox/protocol.ts` (message protocol to sandboxed
    executors).
- Storage passes through `HarnessStorage` adapters
  (`harness-core/src/storage.ts`), inference through the model-provider
  catalog, secrets through `secrets.ts` — no direct environment access.

## 12-factor mapping

| Factor | Harness form |
| --- | --- |
| Config | `SettingsRegistry` + plugin manifests; no literals in components |
| Backing services | Storage/inference/tool capabilities as attached resources, swappable per host |
| Processes | Stateless components; state lives in the event log and storage adapters |
| Port binding / concurrency | Transport-agnostic message endpoints; scale by adding actor instances |
| Disposability | Serializable loop state; crash-safe via LogAct write-ahead logging |
| Dev/prod parity | Same component in-browser and server-side; only the transport and policy compilation differ |
| Logs | Event stream (agentBus + OTel spans), not files |
| Admin processes | Harness commands via `CommandRegistry` |

## Verification ladder

1. **Unit-verify the smallest chunks.** Each component tested in isolation
   with all integration boundaries mocked (lib convention: vitest, 100%
   coverage). Mocks are derived from the declared command/event contracts,
   not hand-rolled shapes.
2. **Contract-verify boundaries.** Message schemas validated at the seam
   (Zod / constrained-decoding JSON schemas), so both sides of every mock
   are pinned to the same contract.
3. **Composition-verify.** After independent capabilities pass, compose them
   and verify the composition: AgentV eval suites at the behavior level,
   Playwright/Cucumber at the surface level. Only verified components are
   eligible for composition; only verified compositions are eligible for
   promotion (mirrors the eval-gated self-improvement rule).

## Durable-async developer contract

Developers integrate in their own language and framework through three
surfaces (see `docs/adr/2026-07-02-durable-workflows.md`):

1. **Handle actor commands** — receive typed commands, do work.
2. **Produce actor events** — append results to the shared log.
3. **Read GraphQL materialized views** — query projections of the event log;
   never read another component's internal state.

Workflow topology itself is authored as intent DSL
(`docs/architecture/dsl-intent-spec.md`), so the wiring between components
is generated and searchable while the handlers remain plain code.

## Hosting tiers

| Tier | Transport | Policy enforcement |
| --- | --- | --- |
| In-process | direct dispatch | policy checked at tool boundary |
| Web Worker / iframe | postMessage (sandbox protocol) | browser sandbox adapters |
| Daemon (`agent-daemon`) | HTTP loopback (OpenAI-compatible) | OS-level (OpenShell target) |
| Server / edge | WDK durable functions, A2A | kernel-level policies |

The component code is identical across tiers; hosting selection is
configuration. `App.tsx` decomposition (out of scope for this change set)
follows this contract: each panel/service becomes a component with declared
commands/events instead of shared `useState`.
