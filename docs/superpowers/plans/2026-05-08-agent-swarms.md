# Agent Swarms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class Agent Browser support for configurable agent swarms that blend xAI-style multi-agent decomposition, Kimi-style broad 16-agent swarm planning, and Copilot Squad-style persistent roles.

**Architecture:** Pure swarm planning lives in `agent-browser/src/services/agentSwarms.ts`. The model-backed chat agent lives under `agent-browser/src/chat-agents/Swarm/` and is wired through the existing chat-agent provider/routing layer.

## Linear Description

TK-19 asks for extensible agent personas and swarms deeply integrated into development loops, asset output production, and task completion workflows. Users should be able to configure agents that behave like leader-led multi-agent teams, horizontally scaled swarms, and persistent squads.

## Feature Implementation Plan

1. Research and extract shared patterns from the requested multi-agent systems.
2. Model reusable swarm templates and deterministic role plans.
3. Add a first-class `Swarm` chat agent that injects the selected plan into the runtime prompt.
4. Route explicit swarm, squad, persona, and parallel-agent requests into the Swarm agent.
5. Cover planner behavior, prompt context, provider helpers, and stream preconditions with tests.
6. Follow up with a persisted Settings UI for custom templates once the large App shell can be published from an environment with working Git.

## Technical Spec

### Service Contract

`agentSwarms.ts` exports:

- `AgentSwarmSettings` for persisted configuration.
- `AgentSwarmTemplate` and `AgentSwarmRole` for persona rosters.
- `DEFAULT_AGENT_SWARM_TEMPLATES` with research, asset-production, and perspective-review templates.
- `buildAgentSwarmPlan({ settings, request })` to select focused or expanded swarms.
- `buildAgentSwarmPromptContext(plan)` to render runtime prompt context.

### Agent Contract

`chat-agents/Swarm/index.ts` exports:

- `AGENT_SWARM_AGENT_ID = 'swarm'` and `AGENT_SWARM_LABEL = 'Swarm'`.
- `isAgentSwarmTaskText(text)` for automatic routing.
- `buildAgentSwarmOperatingInstructions()` for the orchestration contract.
- `buildAgentSwarmSystemPrompt()` and `buildAgentSwarmToolInstructions()`.
- `streamAgentSwarmChat()` delegating to GHCP, Cursor, or Codi while enriching workspace context with the deterministic swarm plan.

### Routing Contract

`chat-agents/index.ts` adds `swarm` to exports, `streamAgentChat`, display names, input placeholders, provider summaries, task routing, and runtime-provider resolution.

## One-Shot LLM Prompt

```text
Implement Linear TK-19 Agent Swarms in Agent Browser.

Follow existing specialist chat-agent patterns. Add `agent-browser/src/services/agentSwarms.ts` with pure planning for configurable swarm templates, focused vs expanded counts, role handoffs, and prompt context. Add `agent-browser/src/chat-agents/Swarm/index.ts` plus tests. Wire `swarm` through `chat-agents/types.ts` and `chat-agents/index.ts` so explicit swarm/squad/parallel-agent/persona tasks route to the new agent and delegate to GHCP, Cursor, or Codi.

Use TDD. Cover settings validation, expanded 16-agent plans, auto-expansion, prompt context, system/tool prompt builders, stream preconditions, provider display, provider summaries, task routing, and runtime resolution. Keep UI follow-up separate if the environment cannot publish the large App shell edit.
```

## TDD Checklist

- [x] Add failing service tests for settings validation, role planning, auto-expansion, and prompt rendering.
- [x] Implement deterministic swarm service.
- [x] Add failing Swarm chat-agent tests for instructions, prompts, detection, and stream preconditions.
- [x] Implement Swarm chat-agent module.
- [x] Add provider-helper routing tests for `swarm`.
- [x] Wire Swarm through chat-agent routing.
- [x] Validate touched files with transpile diagnostics and syntax checks.
- [ ] Run full `npm.cmd run verify:agent-browser` in an environment where Vite/esbuild can read the worktree and dependencies are hydrated.
