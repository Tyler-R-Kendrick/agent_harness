# Architecture: Agent-First MCP Rendering

> Status: **Draft** | Created: 2026-04-04

## System Overview

The agent-first rendering system intercepts the traditional browser rendering pipeline and introduces an agent layer that transforms raw web content into MCP apps. The system is designed around three principles: progressive enhancement (never block on agent processing), workspace-scoped context (the agent reasons about task clusters, not individual tabs), and graceful degradation (passthrough is always available).

```
┌─────────────────────────────────────────────────────────┐
│                    Workspace Process                     │
│                                                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │ Tab Pool  │──▶│ Parse Pipeline│──▶│ Agent Reasoner │  │
│  │ (pages)   │   │ (extraction)  │   │ (context-aware)│  │
│  └──────────┘   └──────────────┘   └───────┬────────┘  │
│                                            │            │
│                                    ┌───────▼────────┐   │
│                                    │ MCP App Engine │   │
│                                    │ (render/compose)│  │
│                                    └───────┬────────┘   │
│                                            │            │
│                              ┌─────────────▼──────────┐ │
│                              │   Presentation Layer    │ │
│                              │ (MCP app ↔ raw toggle) │ │
│                              └────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Page Parse Pipeline

The parse pipeline transforms raw web content into a structured representation the agent can reason about. It runs as a streaming process — partial results are available before full parsing completes.

**Stages:**

| Stage | Input | Output | Latency Target |
|---|---|---|---|
| **DOM Extract** | Raw HTML/JS-rendered DOM | Semantic tree (headings, sections, forms, media, data) | <100ms |
| **Structured Data Extract** | DOM + page metadata | JSON-LD, OpenGraph, schema.org entities, API responses | <200ms |
| **Interactive Element Map** | DOM | Actionable elements (forms, buttons, links) with semantic labels | <150ms |
| **Media Catalog** | DOM + network requests | Media assets with type, source, controls interface | <100ms |
| **Content Fingerprint** | All above | Hash + summary for cache/diff against prior parse | <50ms |

The pipeline is **incremental**: if a page has been parsed before and the content fingerprint matches, cached structured data is reused. This is critical for warm/cool workspace memory tiers where pages may reload.

### 2. Agent Reasoner

The agent reasoner operates at workspace scope. It receives structured data from all tabs in the workspace and determines what to render. Key responsibilities:

**Context Assembly:**
- Reads the workspace's tab set and their parsed representations
- Reads the user's recent interactions (what they clicked, scrolled, typed)
- Reads any explicit user intent signals (search queries, chat messages to the agent)

**Fidelity Decision:**
The reasoner selects a rendering fidelity for each tab and for the workspace as a whole:

```
Input signals:
  - Page complexity (simple article vs complex app)
  - User interaction pattern (reading vs actively using)
  - Workspace composition (single tab vs multi-tab task)
  - User's explicit mode preference (if set)
  - Latency budget (how long since navigation)

Decision outputs:
  - Per-tab fidelity: passthrough | extract | summarize
  - Workspace fidelity: independent (per-tab) | composed (unified MCP app)
  - Composition strategy: which tabs to merge, what interaction model
```

**Progressive Enhancement Loop:**
The reasoner doesn't block navigation. It operates in phases:

1. **Instant** (0-100ms): Passthrough render begins immediately
2. **Fast extract** (100-500ms): If parse pipeline has partial results, overlay extracted content
3. **Full render** (500ms-2s): Replace with full MCP app once agent reasoning completes
4. **Composition** (1-5s): If multi-tab composition is warranted, generate composed view

The user sees content immediately and it progressively transforms. They can freeze at any stage.

### 3. MCP App Engine

The MCP app engine generates and serves interactive MCP applications based on the agent reasoner's decisions. MCP apps are the rendering primitive — they replace the traditional "web page in a tab" with a purpose-built interface.

**App Types:**

| Type | Description | Generation Strategy |
|---|---|---|
| **Extractor App** | Surfaces a subset of a single page | Template-based: media player, article reader, form interface |
| **Summary App** | Agent-generated overview with drill-down | LLM-generated layout + structured data binding |
| **Composite App** | Merges multiple pages into unified interface | LLM-generated custom app with multi-source data binding |
| **Passthrough Wrapper** | Raw page with MCP overlay controls | Thin shell around standard Chromium rendering |

**App Lifecycle:**
1. **Generate**: Agent reasoner requests an app type; engine produces it
2. **Bind**: App is connected to live data sources (parsed page data, action endpoints)
3. **Render**: App is displayed in the workspace's presentation layer
4. **Update**: If source pages change, app receives incremental updates via data bindings
5. **Action**: User interactions in the MCP app are routed back to source pages (form submissions, clicks, API calls)

**Action Routing:**
MCP apps can perform actions on source pages. The action router maps MCP app interactions to page-level operations:

```
MCP App button click "Approve PR"
  → Action Router
    → Identifies source tab (GitHub PR page)
    → Maps to page action (click approve button / call GitHub API)
    → Executes action
    → Updates MCP app state with result
```

### 4. Presentation Layer

The presentation layer manages what the user actually sees. It handles the transition between MCP app views and raw page views, and provides the chrome for controlling the agent rendering system.

**Key behaviors:**
- **Toggle**: User can switch any tab between MCP app view and raw page view instantly
- **Picture-in-picture**: Raw page can be shown alongside the MCP app for verification
- **Freeze**: User can lock current rendering state (stop progressive enhancement)
- **Override**: User can set per-tab or per-workspace fidelity preferences that persist

## Data Flow

```
Navigation event (user opens URL)
  │
  ├──▶ [Immediate] Chromium begins standard page load (passthrough)
  │
  ├──▶ [Async] Parse Pipeline starts extracting content
  │         │
  │         ▼
  │    Structured page data available
  │         │
  │         ▼
  │    Agent Reasoner evaluates:
  │    - This tab's content
  │    - Other tabs in workspace
  │    - User's task context
  │         │
  │         ├──▶ Decision: passthrough → no change, raw page stays
  │         ├──▶ Decision: extract → MCP App Engine generates extractor app
  │         ├──▶ Decision: summarize → MCP App Engine generates summary app
  │         └──▶ Decision: compose → MCP App Engine generates composite app
  │                                   (may wait for other tabs to parse)
  │
  └──▶ Presentation Layer crossfades from raw page to MCP app
       (user can interrupt/toggle at any point)
```

## Integration with Workspace Memory Tiers

The agent rendering system is designed to work with the four-tier workspace memory model:

| Memory Tier | Agent Rendering Behavior |
|---|---|
| **Hot** (full process) | Live MCP apps with real-time updates, full action routing |
| **Warm** (frozen DOM) | Cached MCP app snapshots, re-render on thaw using cached parse data |
| **Cool** (serialized to disk) | MCP app state serialized alongside DOM; restored on demand |
| **Cold** (URL only) | No cached rendering; full parse pipeline runs on re-open |

## Security Model

Agent rendering introduces new attack surfaces that must be addressed:

- **Parse isolation**: The parse pipeline runs in a sandboxed process. Malicious page content cannot escape to the agent reasoner.
- **Action confirmation**: High-impact actions (purchases, account changes, code merges) require explicit user confirmation before the action router executes them.
- **Data boundaries**: The agent reasoner can see all tabs in a workspace, but workspaces are isolated from each other. Cross-workspace data sharing requires explicit user consent.
- **MCP app sandboxing**: Generated MCP apps run in their own sandboxed context, separate from both the source pages and the agent reasoner.

## Open Questions

1. **LLM hosting**: Does the agent reasoner call a cloud LLM, run a local model, or hybrid? (See ADR-001)
2. **Caching granularity**: How aggressively do we cache MCP apps across sessions? Stale composed views could mislead.
3. **Auth propagation**: When an MCP app needs to act on a page that requires auth, how are credentials handled? (See ADR-002)
4. **Offline behavior**: What happens when the agent can't reach its LLM? Graceful degradation to passthrough, or cached MCP apps?
