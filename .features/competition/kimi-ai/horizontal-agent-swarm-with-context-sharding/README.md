# Horizontal Agent Swarm With Context Sharding

- Harness: Kimi AI
- Sourced: 2026-05-11

## What it is
Kimi Agent Swarm is a self-organizing multi-agent mode where one orchestrator decides how to split work, creates sub-agents at runtime, and reconciles their findings without the user pre-authoring roles or workflow graphs.

## Evidence
- Official docs: [K2.6 Agent Swarm [Beta]](https://www.kimi.com/help/agent/agent-swarm)
- Official blog: [Kimi Agent Swarm: 100 Sub-Agents at Scale](https://www.kimi.com/blog/agent-swarm)
- First-party details:
  - the current help-center product surface says Swarm coordinates up to 300 sub-agents in parallel
  - Kimi says Swarm supports more than 4,000 tool calls per task and finishes about 4.5x faster than single-agent execution
  - the product explicitly says there are no predefined roles or hand-crafted workflows required
  - Kimi describes a `Commander + Specialists` architecture where only the orchestrator is trained while sub-agents retain their base skills
  - `Context sharding` gives each sub-agent its own notebook and only bubbles key conclusions back to the orchestrator
  - users can preview, download, or share results, then switch back to single-agent mode for follow-up turns
- Latest development checkpoint:
  - on April 20, 2026, Moonshot AI says Kimi K2.6 upgraded and open-sourced the swarm architecture, moving from the earlier 100-sub-agent blog framing to a 300-sub-agent productized help-center workflow with explicit context-sharding mechanics

## Product signal
Kimi is pushing beyond manually configured specialist teams toward runtime-generated organizations that scale breadth first, shard context aggressively, and only reconcile at the orchestration layer.
