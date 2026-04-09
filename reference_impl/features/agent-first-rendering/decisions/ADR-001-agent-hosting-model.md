# ADR-001: Agent Hosting Model (Local vs Cloud vs Hybrid)

> Status: **Proposed** | Created: 2026-04-04

## Context

The agent reasoner requires LLM inference to make fidelity decisions, generate MCP app layouts, and compose multi-tab views. Where this inference runs has major implications for latency, cost, privacy, and offline capability.

## Decision Drivers

- **Latency**: Agent rendering sits in the critical path between navigation and useful content. Every millisecond counts.
- **Privacy**: The agent sees all content in a workspace. Users may have sensitive data across tabs.
- **Offline**: Browsers must work without internet. If the agent requires cloud LLM access, offline = no agent rendering.
- **Cost**: Cloud LLM inference at browser-rendering frequency could be expensive per user.
- **Quality**: Larger cloud models produce better composition and reasoning than local models (as of early 2026).

## Options Considered

### Option A: Cloud-only (Atlas/Comet model)
All agent reasoning via cloud API calls. Simple architecture, best quality, but latency-bound and privacy-exposed.

### Option B: Local-only (BrowserOS/SigmaOS model)
Ship a local model (e.g., quantized Llama, Phi) with the browser. Full privacy, works offline, but limited reasoning quality and requires significant local compute.

### Option C: Hybrid with tiered routing (Recommended)
Route tasks based on complexity and sensitivity:

| Task | Routing | Rationale |
|---|---|---|
| Fidelity decision (extract/summarize/compose) | Local | Fast, doesn't need frontier model quality |
| Template-based extraction (article, media, form) | Local | Pattern matching, not generative |
| Summary generation | Cloud (default) / Local (fallback) | Quality matters; cloud preferred but not required |
| Custom composite MCP app generation | Cloud | Requires strong reasoning and code generation |
| Sensitive workspace (user-flagged) | Local only | User explicitly opts out of cloud processing |

### Decision

**Option C: Hybrid with tiered routing.**

The parse pipeline and fidelity decisions run locally — these are fast, pattern-based tasks. Summary and composition tasks default to cloud inference but fall back to local models when offline or when the user has flagged a workspace as sensitive. Users can set a global preference (local-only, cloud-preferred, cloud-only) and override per workspace.

## Consequences

- **Good**: Best-of-both-worlds for latency, privacy, and quality
- **Good**: Graceful offline degradation (local model handles basics)
- **Bad**: Two inference paths to maintain and test
- **Bad**: Local model quality may disappoint for composition tasks
- **Neutral**: Need to ship a local model (~2-4GB), increasing browser install size
