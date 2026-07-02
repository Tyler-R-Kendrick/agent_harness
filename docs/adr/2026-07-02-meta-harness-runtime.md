# ADR: Meta-Harness Runtime Facade over harness-core

## Status
Proposed

## Decision
Keep `harness-core` as the runtime kernel. Introduce a Pi/Flue-style
meta-harness facade — a minimal four-tool surface (read, write, edit,
execute) plus the agent loop — as the canonical entry point for generated and
discovered sub-harnesses. External harness frameworks (LangChain DeepAgents,
Vercel eve) enter as optional `ext/` plugins per `docs/plugin-standards.md`,
never as kernel replacements.

## Contract
- The facade exposes exactly: the four base tools, `runHarnessLoop`, the
  hook registry, and a sub-harness descriptor covering the six runtime
  responsibilities (observation, context, control, action, state,
  verification; arXiv:2606.20683).
- A sub-harness is a data artifact (intent-DSL document), not a code fork.
  Generated sub-harnesses are stored in the harness archive with lineage
  (see `2026-07-02-self-improvement-loop.md`).
- DeepAgents-style planning/subagents/virtual-fs and eve-style
  filesystem-first packaging (markdown skills + TS tools) are plugin
  contributions: `agent-harness.plugin.json` manifests with `harness`
  capabilities, resolved through `PluginRegistry`.
- Existing surfaces reused: `harness-core/src/agent.ts` (loop),
  `hooks.ts`, `tools.ts` (ToolRegistry), `plugins.ts`/`pluginManifest.ts`,
  `agent-browser/src/services/agentRunner.ts` (tool loop with telemetry).

## Rollout phases
1. **Phase 0 (shadow):** facade defined as types + docs; sub-harness
   descriptors recorded for existing chat agents without behavior change.
2. **Phase 1 (opt-in):** new chat agents authored as sub-harness descriptors
   executed through the facade; existing agents unchanged.
3. **Phase 2 (core-default):** harness discovery ("find a purpose-built
   harness or emit intent to make one") is the default first step of task
   execution.

## Migration notes
- No existing chat agent under `agent-browser/src/chat-agents/` is rewritten
  in Phase 0-1; descriptors wrap them.
- The facade must not add abstraction over `harness-core` internals beyond
  the descriptor — Ponytail rule: least surface that solves the problem.
