# Act Wisely (arXiv:2604.08545) — Metis/HDPO Research Packet

## Paper intake

- **Title:** Act Wisely: Cultivating Meta-Cognitive Tool Use in Agentic Multimodal Models
- **Canonical link:** https://arxiv.org/abs/2604.08545
- **Publication date:** April 11, 2026 (arXiv v1)
- **Context article:** https://venturebeat.com/orchestration/alibabas-metis-agent-cuts-redundant-ai-tool-calls-from-98-to-2-and-gets-more-accurate-doing-it

## What this paper proposes

The paper introduces **Hierarchical Decoupled Policy Optimization (HDPO)** to train tool-augmented agents that can decide when to abstain from tool usage. Instead of blending “accuracy” and “tool cost” into one scalar reward, HDPO separates optimization into staged policies so the agent can improve correctness while learning efficient tool arbitration.

The resulting model, **Metis**, reports substantial reduction in redundant tool calls while improving reasoning benchmark accuracy.

## Extracted capability to implement in our stack

### Capability

Implement a **Tool Arbitration Layer** for agent-browser style agents that:

1. Predicts whether a tool call is necessary before execution.
2. Enforces a configurable tool budget per turn.
3. Uses a two-objective scorecard (accuracy proxy + efficiency proxy) rather than one monolithic reward.
4. Emits decision traces for offline policy-improvement loops.

### Why it matters

- Reduces latency and API/tool spend in long-horizon agents.
- Decreases noise from unnecessary tool responses.
- Creates an auditable policy surface for alignment and reliability reviews.

## Algorithm sketch adapted to our runtime

1. Compute a **NeedForTool score** from request + context + candidate plan.
2. Gate with a **risk policy**:
   - If high confidence and low external-knowledge need: abstain.
   - Else: call selected tool.
3. Record each decision as an event with:
   - predicted need,
   - whether tool was used,
   - downstream quality signal.
4. Update policy offline with decoupled objectives:
   - maximize task success,
   - minimize unnecessary tool calls under a quality floor.

## Repository artifacts in this packet

- `reference-architecture.md`: integration design for agent-browser and MCP tool stacks.
- `experiments/experiment-01-hdpo-tool-arbitration.md`: experiment protocol.
- `experiments/hdpo-tool-arbitration.ts`: runnable TypeScript scaffold demonstrating arbitration loop + metrics.
