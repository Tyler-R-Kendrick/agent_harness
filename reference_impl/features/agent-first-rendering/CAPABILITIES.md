# Capability Comparison: Agent-First MCP Rendering

> Status: **Draft** | Created: 2026-04-04

## Context Scope Comparison

How much context does the AI have when helping the user?

| Capability | Chrome (Gemini) | Atlas (OpenAI) | Comet (Perplexity) | BrowserOS (MCP) | Dia (Atlassian) | **Ours** |
|---|---|---|---|---|---|---|
| Single-tab awareness | Yes | Yes | Yes | Yes | Yes | Yes |
| Multi-tab awareness | No | Partial | Yes (agentic tasks) | Yes | No | **Yes (workspace-scoped)** |
| Cross-session memory | Limited | Yes (ChatGPT memory) | No | Local storage | No | **Yes (workspace memory tiers)** |
| User task inference | No | Basic | Search-driven | MCP tool context | Productivity heuristics | **Multi-signal (tabs + interactions + chat)** |
| Composition across tabs | No | No | No | No | No | **Yes (core feature)** |

## Rendering Model Comparison

What does the user actually see?

| Capability | Traditional Browser | AI Sidebar (most browsers) | BrowserOS | **Ours** |
|---|---|---|---|---|
| Primary surface | Raw web page | Raw page + sidebar panel | Raw page + MCP tools | **MCP app (agent-generated)** |
| AI output location | N/A | Separate panel | Separate panel | **Replaces page view** |
| Page content transformation | None | Summarize in sidebar | Tool-based extraction | **Semantic extraction → custom UI** |
| Multi-page synthesis | Manual (user reads tabs) | Manual (user copies to sidebar) | Manual (user invokes tools) | **Automatic (workspace composition)** |
| User control over AI rendering | N/A | Open/close sidebar | Invoke/dismiss tools | **Fidelity spectrum with toggle** |
| Fallback to raw page | N/A (always raw) | Close sidebar | Dismiss tool | **Instant toggle, picture-in-picture** |

## Action Routing Comparison

Can the AI take actions on web pages?

| Capability | Chrome (Gemini) | Atlas | Comet | BrowserOS | **Ours** |
|---|---|---|---|---|---|
| Read page content | Yes | Yes | Yes | Yes (MCP) | **Yes (parse pipeline)** |
| Fill forms | Auto Browse (limited) | Yes (agentic) | Yes (agentic) | Yes (MCP tools) | **Yes (action router)** |
| Click/navigate | Auto Browse (limited) | Yes (agentic) | Yes (agentic) | Yes (MCP tools) | **Yes (action router)** |
| Cross-tab actions | No | No | Yes (multi-site flows) | No | **Yes (composed MCP app)** |
| Action confirmation UX | Per-action prompt | Per-action prompt | Per-action prompt | Per-action prompt | **Contextual in MCP app UI** |
| Auth handling | Browser cookies | Browser cookies | Browser cookies + stored creds | Browser cookies | **Sandboxed per-workspace (see ADR-002)** |

## Performance Model Comparison

How does AI integration affect perceived performance?

| Aspect | AI Sidebar Approach | Agentic Browser (Comet/Atlas) | **Ours** |
|---|---|---|---|
| Time to first content | Same as raw page | Same as raw page | **Same (passthrough renders immediately)** |
| Time to AI-enhanced view | Sidebar loads async | Agent processes after page load | **Progressive: 100ms extract → 500ms summarize → 2s compose** |
| Blocking behavior | AI never blocks page | Agent tasks block on completion | **Never blocks; progressive enhancement** |
| Cached repeat visits | No AI caching | Session-based | **Content fingerprint + workspace memory tier caching** |
| Multi-tab overhead | Per-tab sidebar instance | Per-tab agent context | **Shared workspace agent; amortized across tabs** |

## Unique Capabilities (No Current Equivalent)

These capabilities don't exist in any shipping browser today:

| Capability | Description | Example |
|---|---|---|
| **Workspace composition** | Unified MCP app across multiple source pages | Jira + Figma + GitHub PR → single feature review interface |
| **Semantic progressive rendering** | Content transforms from raw → extracted → summarized → composed in real-time | Open a research paper: instantly see the PDF, then headings appear, then key findings summary materializes |
| **Fidelity negotiation** | User and agent collaboratively decide rendering depth | Agent proposes summary view; user drills into a specific section; agent remembers preference for this site |
| **Cross-tab action orchestration** | Single user action triggers coordinated actions across multiple source pages | "Ship this feature" → moves Jira ticket, merges PR, posts Slack update |
| **Memory-tier-aware rendering** | MCP app behavior adapts to workspace memory state | Hot workspace: live dashboard. Cool workspace: frozen snapshot with "refresh" prompt |

## Risk / Tradeoff Matrix

| Tradeoff | Upside | Downside | Mitigation |
|---|---|---|---|
| Agent interprets page content | Surfaces what matters, reduces noise | May misinterpret or omit important content | Always-available raw page toggle; user can flag misses |
| MCP apps replace pages | Purpose-built UX for each task | Unfamiliar paradigm; users expect to see "the website" | Default to extract/passthrough for unfamiliar sites; composed views for recognized task patterns |
| Multi-tab agent context | Enables composition | Privacy concern if tabs contain sensitive cross-domain data | Workspace isolation; explicit cross-workspace consent |
| LLM in the rendering path | Smart, adaptive UI | Latency, cost, offline fragility | Progressive enhancement; local model fallback; aggressive caching |
| Custom MCP app generation | Infinite UI flexibility | Non-deterministic rendering; harder to test/debug | Template library for common patterns; generated apps are inspectable/editable |
