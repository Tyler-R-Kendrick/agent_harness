# Workspace Model Feature

**Status**: Architecture Proposal | **Created**: 2026-04-04 | **Target Implementation**: Chromium 130+

## Problem Statement

Modern browser usage has evolved beyond the original tab-based model. Users today:

- Open dozens of tabs for different projects, each with distinct context and memory pressure implications
- Switch between multiple "modes" (research, development, personal) within a session
- Manually organize tabs into groups, yet lose that structure on restart
- Have no explicit control over which tabs stay in memory vs. are unloaded
- Experience memory bloat when all tabs are equally "hot" despite varying importance

Existing solutions (Chrome tab groups, Arc spaces, Firefox containers) solve parts of this problem, but remain fundamentally:
- **Dual-system**: Tabs and bookmarks are separate, forcing users to duplicate information
- **Memory-agnostic**: No explicit control or visibility over memory tier transitions
- **Process-naive**: The browser's process architecture is hidden from users and unaligned with their mental models

This design unifies tabs, bookmarks, and sessions into a single tree-based workspace model with explicit memory tiers and process-level isolation.

## Proposed Solution

Replace the traditional separate tab-and-bookmark system with a unified **Workspace tree**: a hierarchical, persistent data structure where:

1. **Everything is a node in a tree** (VS Code explorer paradigm)
   - A workspace folder contains tabs and sub-workspaces
   - The tree is always visible in a sidebar
   - Drag-drop reordering and nesting work throughout

2. **Two independent boolean flags control node lifecycle**
   - `persisted`: Does this node survive browser restart? (bookmark-like)
   - `activeMemory`: Is this node pre-loaded and cached? (memory-like)
   - Combined, they form four distinct lifecycle states with different memory costs and latencies

3. **Explicit memory tiers** replace implicit heuristics
   - **Hot** (~50ms activation): Full renderer process, JS running
   - **Warm** (~300ms activation): DOM snapshot cached, JS suspended
   - **Cool** (~1-2s activation): Serialized state on disk, no process
   - **Cold** (~2-5s activation): URL-only bookmark, full reload
   - The browser automatically promotes/demotes nodes between tiers based on memory pressure and user activity

4. **One process per workspace** (not per tab)
   - Workspace subprocess coordinates tabs within that workspace
   - Enables per-workspace resource accounting and lifecycle management
   - Tabs are child processes of the workspace process
   - Crashes are isolated to the workspace; other workspaces continue

5. **Visual clarity** via persistent and active-memory indicators
   - Solid icons for persisted nodes; translucent icons for temporary
   - Green pulsing indicator for nodes in active memory
   - Color-coded tab tiers (red=hot, yellow=warm, blue=cool, gray=cold)

## Core Concepts

### Fidelity Spectrum

The workspace model supports a spectrum of complexity, from simple (new user, few tabs) to advanced (power user, dozens of workspaces with mixed memory tiers):

| Complexity Level | Scenario | Key Features | User Effort |
|---|---|---|---|
| **Simple** | Casual browsing | Temporary tabs and folders, auto-memory management | None; automatic |
| **Intermediate** | Projects and organization | Persisted workspaces, manual grouping, basic memory hints | Low; UI-driven |
| **Advanced** | Resource-intensive workflows | Explicit memory budgets, tier configuration, workspace templates | High; config-driven |

### Key Abstractions

**WorkspaceNode**: The atomic unit of the tree structure. Can be a folder (workspace) or a page (tab). Carries identity, hierarchy, persistence flags, memory tier, and process association.

**Memory Tier**: Explicit categorization of a node's memory state (hot/warm/cool/cold) and its corresponding process/storage layout. Transitions are driven by timeouts, memory pressure, and user actions.

**Persistence Flag** (`persisted`): User-settable boolean. If true, the node is saved to disk as a bookmark and survives restart. If false, it's ephemeral.

**Active Memory Flag** (`activeMemory`): User-settable boolean. If true, the node's content is cached in memory (warm or hot tier). If false, it's loaded on-demand.

**Workspace Process**: A subprocess that supervises all tabs within a workspace. Enables isolation, resource tracking, and per-workspace lifecycle management.

**Process Hierarchy**: Browser → Workspace Process → Tab (Renderer) Process. Replaces the flat Browser → Tab model with explicit nesting.

## Relationship to Existing Architecture

### Replaces
- **TabStripModel** (for group operations and hierarchical organization)
- **TabGroupModel** (tab grouping)
- **BookmarkModel** (partially; bookmarks become persistent workspace nodes)

### Extends
- **Session Restore** (now workspace-aware; respects persistence and activeMemory flags)
- **Resource Coordinator** (adds workspace-level memory budgeting and tier management)
- **RenderProcessHostImpl** (assigns renderers to workspace processes)
- **SiteInstanceImpl** (carries workspace context)

### Coexists With (During Migration)
- **Existing TabStripModel** (deprecated but functional; new code uses WorkspaceModel)
- **Tab Groups** (superseded by workspaces, but imports are supported)

## Success Criteria

1. **Memory efficiency**: Workspaces in cool/cold tiers use <1% of the memory of hot tier workspaces.
2. **Activation latency**: Promoting a workspace from warm to hot takes <500ms; from cold to hot takes <2s.
3. **UI responsiveness**: Creating, renaming, and dragging workspaces responds within 100ms.
4. **Persistence accuracy**: 100% of persisted workspaces are restored on restart with correct hierarchy and memory flags.
5. **Process isolation**: Crash or memory overload in one workspace process does not degrade other workspaces.
6. **User adoption**: Users actively use persistence flags and explicit memory tier management (telemetry-driven).

## Document Index

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: Technical deep-dive into components, data flow, and integration points
- **[CAPABILITIES.md](./CAPABILITIES.md)**: Feature comparison against tab groups, containers, tab stacking, and competitors
- **[decisions/](./decisions/)**: Architecture decision records explaining key design choices
  - **[ADR-001-unified-tree-vs-separate-systems.md](./decisions/ADR-001-unified-tree-vs-separate-systems.md)**: Why merge tabs and bookmarks
  - **[ADR-002-four-tier-memory-model.md](./decisions/ADR-002-four-tier-memory-model.md)**: Why 4 tiers instead of 2 or 3
  - **[ADR-003-process-per-workspace.md](./decisions/ADR-003-process-per-workspace.md)**: Why isolate processes by workspace
  - **[ADR-004-dual-persistence-flags.md](./decisions/ADR-004-dual-persistence-flags.md)**: Why persisted and activeMemory are independent

---

**Version**: 1.0
**Last Updated**: 2026-04-04
**Feedback**: See the architecture documents and ADRs for implementation planning.
