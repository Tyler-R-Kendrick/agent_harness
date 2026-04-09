# Workspace Architecture Design Spec
## Chromium-Based Browser Fork: Unified Workspace Concept

**Document Version**: 1.0
**Last Updated**: 2026-04-04
**Target Implementation**: Ungoogled-Chromium Base Fork
**Status**: Architecture Design Phase

---

## Executive Summary

This document specifies the architecture for a next-generation browser workspace system that unifies tab groups, bookmarks, and sessions into a single hierarchical data model. The design emphasizes:

- **First-principles reimagining**: Abandoning legacy patterns in favor of cleaner abstractions
- **Memory-aware tiering**: Intelligent management of renderer processes across performance/memory trade-offs
- **Process hierarchy**: Workspace-scoped subprocesses that enable isolation and per-workspace resource accounting
- **Dual persistence flags**: Separate concepts for persistence (saved across sessions) and active memory (preloaded/cached)
- **Visual clarity**: Distinct iconography and state indicators for users to understand memory tier and lifecycle state

This spec is implementable by Chromium engineers with modifications to the content layer, process model, persistence layer, and UI.

---

## 1. Core Concept: Workspaces as First-Class Entities

### 1.1 Philosophy

Traditional browsers treat tabs, bookmarks, and tab groups as separate concerns:
- **Tabs** are ephemeral, session-scoped, RAM-resident contexts
- **Bookmarks** are persistent, hierarchical references to URLs
- **Tab Groups** are recent, organizational abstractions over tabs

**Workspace model**: Unify these into a single tree structure where:
- A workspace is a **virtual folder** containing pages and sub-workspaces
- Pages are either **open** (rendered in a tab) or **bookmarked** (persisted reference)
- The tree is **always visible** as a sidebar (VS Code explorer paradigm)
- Memory state is **explicit**: each workspace declares whether it's in active memory or dormant

### 1.2 Key Design Principles

1. **Hierarchy is primary**: Everything is a tree. Flat tab bars are secondary UI.
2. **Explicit is better than implicit**: Persistence and memory state are user-settable, not magic.
3. **Process equals workspace**: Each folder gets a subprocess; tabs are children of that subprocess.
4. **Memory budgets matter**: The browser allocates fixed memory per tier; workspaces compete for resources.
5. **Graceful degradation**: Cold tier (URL-only) → Warm tier (snapshot) → Hot tier (process) → no process at all.

---

## 2. Data Model

### 2.1 WorkspaceNode: Core Entity

Every node in the workspace tree is a `WorkspaceNode`:

```typescript
interface WorkspaceNode {
  // Identity
  id: string;                    // UUID, immutable
  name: string;                  // Display name, user-editable
  parentId: string | null;       // NULL for root; enables fast parent lookup

  // Hierarchy
  children: WorkspaceNode[];     // Child workspaces or tabs
  childOrder: string[];          // Array of child IDs for ordering (allows O(1) reorder via drag-drop)

  // Type discrimination
  type: "workspace" | "tab";     // Folder or open page

  // Tab-specific properties (only populated when type === "tab")
  url?: string;                  // e.g., "https://example.com/page"
  title?: string;                // Page title from <title> tag
  favicon?: string;              // Data URI or base64-encoded favicon

  // Memory & Process State
  activeMemory: boolean;         // Should this node's content be pre-cached in memory?
  persisted: boolean;            // Should this node survive browser restart?

  // Lifecycle Flags
  isActive: boolean;             // Currently focused/foreground workspace
  memoryTier: "hot" | "warm" | "cool" | "cold";  // See § 4 for definitions
  processId?: number;            // PID of workspace subprocess (for type==="workspace")
  tabProcessIds?: Map<string, number>;  // PID map for child tabs (for type==="workspace")

  // Timestamps
  createdAt: number;             // Unix timestamp (ms)
  lastAccessedAt: number;        // Unix timestamp (ms) for LRU eviction
  lastModifiedAt: number;        // Unix timestamp (ms) for sync

  // Serialization (for dormant workspace snapshots)
  serializedState?: WorkspaceSnapshot;  // DOM snapshot, scroll position, form data, etc.

  // Metadata
  icon?: string;                 // Custom emoji or icon identifier
  color?: string;                // Optional color tag for visual grouping
  tags?: string[];               // User-defined tags for searching/filtering
  template?: boolean;            // Is this workspace a reusable template?
}

interface WorkspaceSnapshot {
  // Captured state of a workspace's tabs before hibernation
  tabSnapshots: TabSnapshot[];
  metadata: {
    capturedAt: number;
    browserVersion: string;
  };
}

interface TabSnapshot {
  // Minimal representation of a tab's state when not in a process
  url: string;
  title: string;
  favicon: string;
  scrollPosition: { x: number; y: number };
  formData: Record<string, string>;  // Serialized form fields
  cookies: string[];  // Relevant cookies scoped to this tab
  localStorage: Record<string, string>;  // Serialized localStorage
}
```

### 2.2 Persistence Flags Semantics

Two independent boolean flags control a node's lifecycle:

#### `persisted: boolean`

- **TRUE**: Node is saved to disk as a bookmark. Survives browser restart. Part of the "bookmark library."
- **FALSE**: Node is temporary workspace context. Lost when browser closes (unless `activeMemory` keeps it alive).
- **Semantics**: "Is this a long-term reference I want to save?"

#### `activeMemory: boolean`

- **TRUE**: Node's content is pre-loaded and cached in memory (warm or hot tier). High memory cost, fast activation.
- **FALSE**: Node's content is loaded on-demand or from disk (cool/cold tier). Low memory cost, slower activation.
- **Semantics**: "Is this actively part of my current workflow?"

#### Combined States & Lifecycle

| persisted | activeMemory | Lifecycle | Use Case | Memory Cost |
|-----------|--------------|-----------|----------|-------------|
| FALSE     | FALSE        | Temporary context, garbage collected after timeout | Ad hoc search, one-off browsing | Minimal |
| FALSE     | TRUE         | Ephemeral working context, active this session only | Current work-in-progress, multi-tab task | Medium |
| TRUE      | FALSE        | Persistent bookmark, loaded on-demand | Project bookmarks, reference links | Minimal |
| TRUE      | TRUE         | Persistent, always-ready workspace | Daily driver projects, critical contexts | High |

### 2.3 RootWorkspace

The root of the hierarchy is a special node:

```typescript
interface RootWorkspace extends WorkspaceNode {
  id: "root";
  name: "Workspaces";
  parentId: null;
  persisted: true;  // Always saved
  activeMemory: false;  // Not rendered directly
  type: "workspace";
  children: WorkspaceNode[];
}
```

The root is always persisted and never has a process. Its children are top-level workspaces.

---

## 3. Visual Indicator System

### 3.1 Icon/Pinning System

**Persisted vs Temporary**:
- `persisted=true`: **Solid icon** (📌 pinned bookmark, ⭐ star, 📁 folder)
- `persisted=false`: **Translucent/dashed icon** (🔲 hollow square, 📂 outline folder, or 30% opacity overlay)

**Visual Implementation**:
```css
.workspace-node.persisted {
  opacity: 1;
  icon-weight: 600;  /* Bold/filled icons */
}

.workspace-node.temporary {
  opacity: 0.6;  /* Slightly dimmed */
  icon-weight: 300;  /* Light/outlined icons */
  border-left: 2px dashed currentColor;  /* Dashed accent */
}
```

### 3.2 Active Memory Indicator

**Active Memory vs Dormant**:
- `activeMemory=true`: **Live indicator dot** (🟢 green pulsing circle) + **highlighted border**
- `activeMemory=false`: **Dimmed/grayed out**

**Visual Implementation**:
```css
.workspace-node.active-memory {
  border-left: 3px solid #00ff00;
  box-shadow: inset 0 0 6px rgba(0, 255, 0, 0.3);
}

.workspace-node.active-memory::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #00ff00;
  animation: pulse 1.5s infinite;
  margin-right: 6px;
}

.workspace-node.dormant {
  opacity: 0.5;
  color: #999;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### 3.3 Combined State Indicators

**Four primary states** with distinct visual appearance:

```
┌─────────────────────────────────────────────────────────────┐
│ Workspace Node Visual States (Sidebar Rendering)           │
├─────────────────────────────────────────────────────────────┤
│ 1. PERSISTED + ACTIVE (⭐🟢)                                │
│    Icon: Solid star/pin, glowing green border               │
│    Opacity: 100%, Bold                                      │
│    Message: "This is always ready"                          │
│                                                              │
│ 2. PERSISTED + DORMANT (⭐)                                 │
│    Icon: Solid star/pin, normal border                      │
│    Opacity: 80%, Normal weight                              │
│    Message: "This is saved but sleeping"                    │
│                                                              │
│ 3. TEMPORARY + ACTIVE (📂🟢)                                │
│    Icon: Outline/hollow folder, glowing green border        │
│    Opacity: 100%, Bold                                      │
│    Message: "This is active but will disappear"             │
│                                                              │
│ 4. TEMPORARY + DORMANT (📂)                                 │
│    Icon: Outline/hollow folder, dashed border               │
│    Opacity: 50%, Light weight                               │
│    Message: "This is temporary and might be deleted soon"   │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Tab State Indicator Within Folders

Tabs within a workspace show their memory tier:

```
┌─ Project Alpha (activeMemory, persisted) ⭐🟢
│
├─ 🔴 Tab 1 (Hot)     — Full process, live JS execution
├─ 🟡 Tab 2 (Warm)    — DOM snapshot, frozen renderer
├─ 🔵 Tab 3 (Cool)    — URL + metadata, no process
└─ ⚫ Tab 4 (Cold)     — URL only, no metadata
```

**Color coding for tabs**:
- 🔴 **Red/Hot**: Full renderer process alive, actively consuming CPU/memory
- 🟡 **Yellow/Warm**: Frozen renderer, DOM snapshot cached, fast restore (<500ms)
- 🔵 **Blue/Cool**: Serialized state on disk, slower restore (~1-2s)
- ⚫ **Gray/Cold**: URL-only bookmark, full restore from network/cache (~2-5s)

---

## 4. Memory Tier Architecture

### 4.1 Four-Tier Memory Model

The browser manages workspace memory across four distinct tiers, optimizing for latency and memory efficiency:

#### Tier 1: Hot (Full Process)

- **Process state**: Full renderer process alive and running
- **JS context**: Execution context maintained, event loop active
- **Memory cost**: ~50-150 MB per tab (varies by page complexity)
- **Activation latency**: <50ms (immediate)
- **Suitable for**: Actively viewed workspace, immediate tabs in focus
- **Transition triggers**:
  - **Promoted from Warm** when: User clicks on workspace; activeMemory pre-loads it
  - **Demoted to Warm** when: Timeout (configurable, default 5 minutes of inactivity) or memory pressure

#### Tier 2: Warm (Frozen DOM Snapshot)

- **Process state**: Renderer process exists but frozen; DOM tree persisted to memory
- **JS context**: Paused/suspended; JavaScript execution stopped
- **Memory cost**: ~20-50 MB per tab (DOM + CSS layout tree only, no JS heap)
- **Activation latency**: ~300-500ms (restore JS context from frozen state)
- **Suitable for**: Workspaces in activeMemory but not currently in focus
- **Transition triggers**:
  - **Promoted from Cool** when: User hovers over workspace; activeMemory flag set
  - **Demoted from Hot** when: Timeout or memory pressure
  - **Demoted to Cool** when: activeMemory flag unset or memory pressure

#### Tier 3: Cool (Serialized State on Disk)

- **Process state**: No process. State serialized to disk (SQLite cache or JSON files)
- **Storage**: URL + scroll position + form data + localStorage + cookies
- **Memory cost**: ~1-5 KB metadata per tab (references only, actual data on disk)
- **Activation latency**: ~1-2 seconds (deserialize from disk, spawn process, restore state)
- **Suitable for**: Persisted workspaces not in activeMemory; dormant temporary workspaces
- **Transition triggers**:
  - **Promoted from Cold** when: Persisted flag set
  - **Demoted from Warm** when: Memory pressure or activeMemory unset
  - **Demoted to Cold** when: Persisted flag unset; automatic cleanup

#### Tier 4: Cold (URL-Only Bookmark)

- **Process state**: No process. Only URL stored.
- **Storage**: URL + title + favicon (no state)
- **Memory cost**: ~200 bytes per tab (metadata reference only)
- **Activation latency**: ~2-5 seconds (network request to reload; browser cache/SW may help)
- **Suitable for**: Ephemeral bookmarks, new workspaces not yet persisted
- **Transition triggers**:
  - **Promoted from N/A** when: New workspace created or persisted flag unset
  - **Demoted to Garbage** when: Temporary + dormant + timeout exceeded

### 4.2 State Transition Diagram

```
                         User Action / System Event
                                   ↓
    ┌─────────────────────────────────────────────────────────┐
    │                                                          │
    │  ┌──────────────┐      timeout/memory        ┌────────┐ │
    │  │     COLD     │ ←────────pressure────→ │   HOT   │ │
    │  │  (URL-only)  │                         │ (full)  │ │
    │  └──────────────┘                         └────────┘ │
    │         ↑                                      ↑       │
    │         │ persisted flag unset or             │       │
    │         │ cleanup timeout exceeded            │       │
    │         │                                     │       │
    │  ┌──────────────┐      user interaction   ┌────────┐ │
    │  │     COOL     │ ←─────or activeMemory──→ │ WARM   │ │
    │  │ (disk state) │ ────────preservation───→ │(frozen)│ │
    │  └──────────────┘                         └────────┘ │
    │                                                       │
    │  Garbage Collection Bin (deletion):                   │
    │  Temporary + Cold + (lastAccessedAt + timeout < now) │
    │                                                       │
    └─────────────────────────────────────────────────────────┘
```

### 4.3 Memory Budget Allocation

The browser allocates a fixed memory budget across tiers:

```
Total Browser Memory Budget: 2000 MB (configurable per platform)

├─ Hot Tier Budget: 600 MB (30%)
│  └─ Actively rendered workspaces
│  └─ Sub-allocation: Primary workspace 200 MB, secondary workspaces 400 MB
│
├─ Warm Tier Budget: 600 MB (30%)
│  └─ Frozen DOM snapshots
│  └─ Pre-cached activeMemory workspaces
│
├─ Cool Tier Budget: 500 MB (25%)
│  └─ Serialized state on disk
│  └─ Metadata cache in RAM (~50 MB), rest streamed from disk
│
├─ Static Memory (UI, extensions, etc.): 200 MB (10%)
│  └─ Sidebar, toolbar, extension APIs
│
└─ Reserved (safety margin): 100 MB (5%)
   └─ For transient spikes
```

**Memory Pressure Response** (when actual > budget):

1. **Hot → Warm**: Demote least-recently-accessed hot workspaces
2. **Warm → Cool**: Serialize warm snapshots to disk; free memory
3. **Cool → Cold**: Drop cool tier serializations; keep URL-only references
4. **Garbage collection**: Delete temporary + cold workspaces exceeding age threshold

### 4.4 Memory Tier Configuration

```typescript
interface MemoryTierConfig {
  // Timeouts for demotion
  hotToWarmTimeout: number;          // Default: 5 minutes (300,000 ms)
  warmToCoolTimeout: number;         // Default: 30 minutes (1,800,000 ms)
  coolToGarbageTimeout: number;      // Default: 24 hours (86,400,000 ms), temp only

  // Memory budgets (bytes)
  hotBudgetBytes: number;            // Default: 600 * 1024 * 1024
  warmBudgetBytes: number;           // Default: 600 * 1024 * 1024
  coolBudgetBytes: number;           // Default: 500 * 1024 * 1024

  // Eviction strategy
  evictionPolicy: "LRU" | "FIFO";    // Default: LRU (least-recently-used)

  // activeMemory workspace behavior
  activeCachingStrategy: "preload" | "lazy";  // Default: preload (move to warm on startup)
}
```

---

## 5. Process Model

### 5.1 Subprocess Hierarchy

The traditional Chromium process model (Browser → Tab processes) is augmented with a **Workspace process layer**:

```
┌─ Browser Main Process (PID 1000)
│
├─ Workspace "Projects" (PID 1100)
│  ├─ Tab "Design Doc" (PID 1101)
│  ├─ Tab "Code Repo" (PID 1102)
│  └─ Tab "Figma" (PID 1103)
│
├─ Workspace "Research" (PID 1200)
│  ├─ Tab "Paper 1" (PID 1201)
│  ├─ Tab "Paper 2" (PID 1202)
│  └─ Sub-workspace "Notes" (PID 1210)
│     └─ Tab "Notes Doc" (PID 1211)
│
├─ Workspace "Personal" (PID 1300)
│  ├─ Tab "Email" (PID 1301)
│  └─ Tab "Banking" (PID 1302)
│
└─ GPU Process, Plugin Processes, etc.
```

### 5.2 Workspace Process Lifecycle

**Creation**:
1. User creates new workspace via UI ("New Workspace" button)
2. WorkspaceNode allocated with `type="workspace"`
3. **No process spawned yet** (lazy initialization)
4. Workspace remains in "dormant" state until first tab is added or `activeMemory` toggled

**Activation** (first tab added or activeMemory flag set):
1. Workspace process spawned (utility process, not content process)
2. Process ID stored in `WorkspaceNode.processId`
3. Process enters listening mode, awaits child tab processes
4. Memory tier promoted to Hot or Warm

**Tab Creation within Workspace**:
1. New tab created in workspace
2. Content process spawned as **child of workspace process**
3. Workspace process manages the tab's lifecycle, resource limits, IPC
4. Tab process parent PID is workspace process (OS sees hierarchy)

**Workspace Focus/Unfocus**:
- **Focus**: Workspace tier promoted; children promoted
- **Unfocus**: Workspace tier demoted per timeout; children follow

**Deactivation** (user closes workspace):
1. Hibernation phase: State serialized (if `activeMemory` or `persisted`)
2. Termination phase: Workspace process terminated (SIGTERM)
3. OS cascades SIGTERM to all child tab processes
4. Graceful shutdown: ~2 second timeout before SIGKILL
5. Resource accounting finalized; memory released

### 5.3 Workspace Process Responsibilities

Each workspace process (utility process) handles:

```typescript
class WorkspaceProcess {
  workspaceId: string;
  processPid: number;
  parentProcessPid: number;  // Browser main process

  // Lifecycle management
  async initialize(config: WorkspaceConfig): Promise<void>;
  async terminate(force: boolean): Promise<void>;

  // Child tab management
  children: Map<string, ContentProcess>;
  async spawnTab(tabId: string, url: string): Promise<number>;
  async closeTab(tabId: string): Promise<void>;
  async getTabResourceUsage(): Promise<Map<string, ResourceMetrics>>;

  // State serialization (on hibernation)
  async serializeState(): Promise<WorkspaceSnapshot>;
  async restoreState(snapshot: WorkspaceSnapshot): Promise<void>;

  // IPC handlers
  onChildMessage(tabId: string, message: IpcMessage): void;
  onMemoryPressure(): Promise<void>;  // Demote children or self

  // Resource limits (per workspace, not per tab)
  memoryLimit: number;  // e.g., 400 MB for non-primary workspace
  cpuQuota: number;     // e.g., 50% for background workspace
}
```

### 5.4 Process Termination Modes

**Graceful Hibernation** (default):
```typescript
async terminateWorkspace(workspaceId: string) {
  const workspace = getWorkspace(workspaceId);

  // Phase 1: Serialize state (if persisted or activeMemory)
  if (workspace.persisted || workspace.activeMemory) {
    workspace.serializedState = await workspace.process.serializeState();
    await persistWorkspaceSnapshot(workspace.serializedState);
  }

  // Phase 2: Notify children, give them time to clean up
  await workspace.process.send({ type: 'prepare_shutdown' });
  await new Promise(r => setTimeout(r, 2000));  // 2-second grace period

  // Phase 3: Terminate (SIGTERM) and wait for clean exit
  const terminated = await workspace.process.terminate(force=false);
  if (!terminated) {
    // Force kill if didn't exit gracefully
    workspace.process.kill();
  }

  // Phase 4: Cleanup
  workspace.processId = undefined;
  workspace.memoryTier = "cold";  // Or "cool" if persisted
}
```

**Force Termination** (emergency, memory pressure):
```typescript
async forceTerminateWorkspace(workspaceId: string) {
  const workspace = getWorkspace(workspaceId);
  // Skip serialization; directly kill the process tree
  workspace.process.kill(SIGKILL);
  workspace.processId = undefined;
  // Workspace data in cool/cold tier is lost; only URL references remain
}
```

---

## 6. Workspace Lifecycle

### 6.1 State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                    Workspace Lifecycle State Machine            │
└─────────────────────────────────────────────────────────────────┘

       ┌──────────────────────┐
       │    NEW/TEMPORARY     │
       │  (created this       │
       │   session)           │
       └──────────────────────┘
              ↓
         User adds tabs
         or enables
         activeMemory
              ↓
       ┌──────────────────────┐
       │    ACTIVE/WARM       │ ← User interactions keep this tier
       │  (rendered, cached)  │
       └──────────────────────┘
              ↓
         Timeout or memory
         pressure triggers
         demotion
              ↓
       ┌──────────────────────┐
       │    DORMANT/COOL      │ ← Serialized state on disk
       │  (saved, process     │
       │   killed)            │
       └──────────────────────┘
              ↓
       (User clicks to reactivate)
              ↓ OR
       (Temp, old, garbage collection)
              ↓
       ┌──────────────────────┐
       │     DELETED          │ ← Workspace node + data purged
       │  (removed from tree) │
       └──────────────────────┘

   Parallel: User toggles "persisted" flag
   ┌──────────────────────────────────────┐
   │ persisted=false → persisted=true      │
   │ Workspace moves to bookmark library   │
   │ Survives browser close                │
   │ Restored to cool tier on restart      │
   └──────────────────────────────────────┘
```

### 6.2 Creation

```typescript
async createWorkspace(name: string, parent?: WorkspaceNode): Promise<WorkspaceNode> {
  const workspace: WorkspaceNode = {
    id: generateUUID(),
    name: name,
    parentId: parent?.id ?? "root",
    type: "workspace",
    children: [],
    childOrder: [],

    // Defaults
    persisted: false,          // Temporary until user bookmarks it
    activeMemory: false,       // Dormant until user opens it or sets flag
    isActive: false,
    memoryTier: "cold",        // No process yet

    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    lastModifiedAt: Date.now(),
  };

  // Add to tree
  parent = parent ?? getRootWorkspace();
  parent.children.push(workspace);
  parent.childOrder.push(workspace.id);

  // Persist to disk (workspace tree metadata)
  await persistWorkspaceTree();

  // No process created yet (lazy initialization)
  // Process spawned only when:
  // 1. First tab is added, OR
  // 2. activeMemory flag is set, OR
  // 3. User explicitly opens the workspace

  return workspace;
}
```

### 6.3 Bookmarking (Toggle Persistent Flag)

```typescript
async togglePersisted(workspaceId: string): Promise<void> {
  const workspace = findWorkspace(workspaceId);

  if (!workspace.persisted) {
    // User is bookmarking this workspace
    workspace.persisted = true;
    workspace.lastModifiedAt = Date.now();

    // If workspace is dormant (no process), serialize any cached state
    if (!workspace.processId && workspace.serializedState) {
      // Already has cached snapshot; keep it
    } else if (workspace.processId && workspace.memoryTier === "hot") {
      // Force a serialization now while active
      workspace.serializedState = await getWorkspaceProcess(workspace.id).serializeState();
    }

    // Write to persistent storage (bookmark DB)
    await persistWorkspaceTree();
  } else {
    // User is un-bookmarking this workspace
    workspace.persisted = false;
    workspace.lastModifiedAt = Date.now();

    // If workspace is dormant and old, it's now a candidate for garbage collection
    // If workspace is active, it remains in memory until timeout

    await persistWorkspaceTree();
  }
}
```

### 6.4 Activation (Toggle ActiveMemory or Open)

```typescript
async activateWorkspace(workspaceId: string): Promise<void> {
  const workspace = findWorkspace(workspaceId);

  // Mark as active in UI
  workspace.isActive = true;
  workspace.lastAccessedAt = Date.now();

  // Promote memory tier
  if (!workspace.processId) {
    // Workspace has no process; need to spawn one
    if (workspace.serializedState) {
      // Restore from serialized state → warm tier
      workspace.memoryTier = "warm";
      await spawnWorkspaceProcess(workspace);
      await getWorkspaceProcess(workspace.id).restoreState(workspace.serializedState);
    } else {
      // Fresh spawn; start as hot tier
      workspace.memoryTier = "hot";
      await spawnWorkspaceProcess(workspace);
    }
  } else {
    // Workspace has a process; promote tier if needed
    if (workspace.memoryTier === "warm") {
      workspace.memoryTier = "hot";  // Unfreeze renderer
      // Thaw JS execution context
    }
  }

  // Update UI
  updateSidebarUI();
  focusWorkspaceInViewport(workspace);
}
```

### 6.5 Hibernation (Deactivation)

```typescript
async hibernateWorkspace(workspaceId: string): Promise<void> {
  const workspace = findWorkspace(workspaceId);

  // Mark as inactive
  workspace.isActive = false;

  if (!workspace.processId) {
    // Already hibernated; nothing to do
    return;
  }

  // Phase 1: Serialize state
  if (workspace.persisted || workspace.activeMemory) {
    workspace.serializedState = await getWorkspaceProcess(workspace.id).serializeState();
  }

  // Phase 2: Demote memory tier
  if (workspace.serializedState) {
    workspace.memoryTier = "cool";
  } else {
    workspace.memoryTier = "cold";
  }

  // Phase 3: Terminate process
  await terminateWorkspaceProcess(workspace.id, force=false);
  workspace.processId = undefined;
  workspace.tabProcessIds = undefined;

  // Persist updated tree
  await persistWorkspaceTree();

  // Update UI
  updateSidebarUI();
}
```

### 6.6 Session Restore (Browser Startup)

```typescript
async restoreWorkspacesOnStartup(): Promise<void> {
  // Load workspace tree from persistent storage
  const tree = await loadWorkspaceTree();

  // Iterate through persisted workspaces
  for (const workspace of walkTree(tree, { filter: (n) => n.persisted })) {
    // Determine initial memory tier
    if (workspace.activeMemory) {
      // Restore to warm tier (preload snapshot if available)
      workspace.memoryTier = "warm";

      if (workspace.serializedState) {
        // Queue workspace for restoration to warm tier
        // (deferred to avoid startup lag spike)
        queueWorkspaceRestoration(workspace, "warm");
      }
    } else {
      // Keep as cold tier (URL only)
      workspace.memoryTier = "cold";
      workspace.processId = undefined;
    }
  }

  // Begin restoration in background (prioritize activeMemory workspaces)
  await restoreWorkspacesInBackground(/* max_concurrent: 2 */);

  // Restore UI state (sidebar visibility, scroll position, etc.)
  restoreSidebarUI(tree);
}

async restoreWorkspacesInBackground(maxConcurrent: number) {
  const queue = getWorkspaceRestorationQueue();

  while (!queue.empty()) {
    const batch = queue.pop(maxConcurrent);

    await Promise.all(
      batch.map(async (workspace) => {
        try {
          await spawnWorkspaceProcess(workspace);
          if (workspace.serializedState) {
            await getWorkspaceProcess(workspace.id).restoreState(workspace.serializedState);
          }
          workspace.memoryTier = workspace.serializedState ? "warm" : "hot";
        } catch (e) {
          console.error(`Failed to restore workspace ${workspace.id}:`, e);
          workspace.memoryTier = "cold";  // Fallback to cold
        }
      })
    );

    // Yield to main thread to avoid blocking UI
    await new Promise(r => setTimeout(r, 100));
  }
}
```

### 6.7 Garbage Collection

```typescript
async garbageCollectWorkspaces(): Promise<void> {
  // Run periodically (e.g., every 5 minutes) or on-demand

  const now = Date.now();
  const tempDormantTimeout = 24 * 60 * 60 * 1000;  // 24 hours

  for (const workspace of walkTree(getRootWorkspace())) {
    // Only delete temporary workspaces
    if (workspace.persisted) continue;

    // Must be dormant (no active process)
    if (workspace.processId) continue;

    // Must be old
    const age = now - workspace.lastAccessedAt;
    if (age < tempDormantTimeout) continue;

    // Candidate for deletion; remove from tree
    const parent = findWorkspace(workspace.parentId);
    parent.children = parent.children.filter(c => c.id !== workspace.id);
    parent.childOrder = parent.childOrder.filter(id => id !== workspace.id);

    console.log(`GC: Deleted temporary workspace ${workspace.id}`);
  }

  // Persist updated tree
  await persistWorkspaceTree();
}
```

---

## 7. Persistence Layer

### 7.1 Storage Architecture

Workspaces are persisted across multiple storage backends:

```
┌─ Workspace Tree Metadata (SQLite)
│  ├─ WorkspaceNode table: id, name, type, parentId, icon, color, tags, etc.
│  ├─ PeristenceFlags table: id, persisted, activeMemory
│  └─ Timestamps table: id, createdAt, lastAccessedAt, lastModifiedAt
│
├─ Workspace Snapshots (Disk filesystem or SQLite BLOB)
│  ├─ /workspaces/{workspace-id}/snapshot.json
│  │  └─ TabSnapshot array, metadata
│  ├─ /workspaces/{workspace-id}/cookies.txt
│  ├─ /workspaces/{workspace-id}/localStorage.json
│  └─ /workspaces/{workspace-id}/forms.json
│
└─ UI State (JSON)
   ├─ sidebar-collapsed: boolean
   ├─ sidebar-width: number
   ├─ expanded-workspaces: string[]
   └─ last-focused-workspace: string
```

### 7.2 Persistence API

```typescript
interface WorkspacePersistenceLayer {
  // Tree operations
  saveWorkspaceTree(tree: WorkspaceNode): Promise<void>;
  loadWorkspaceTree(): Promise<WorkspaceNode>;

  // Snapshot operations
  saveWorkspaceSnapshot(workspace: WorkspaceNode, snapshot: WorkspaceSnapshot): Promise<void>;
  loadWorkspaceSnapshot(workspaceId: string): Promise<WorkspaceSnapshot | null>;
  deleteWorkspaceSnapshot(workspaceId: string): Promise<void>;

  // Metadata operations
  updateWorkspaceMetadata(workspaceId: string, metadata: Partial<WorkspaceNode>): Promise<void>;

  // Transaction support
  async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}
```

### 7.3 Data Format Examples

**workspace-tree.json**:
```json
{
  "id": "root",
  "name": "Workspaces",
  "type": "workspace",
  "persisted": true,
  "activeMemory": false,
  "children": [
    {
      "id": "ws-project-alpha",
      "name": "Project Alpha",
      "type": "workspace",
      "persisted": true,
      "activeMemory": true,
      "icon": "📁",
      "color": "blue",
      "createdAt": 1712246400000,
      "lastAccessedAt": 1712329200000,
      "children": [
        {
          "id": "tab-123",
          "name": "Design Doc",
          "type": "tab",
          "url": "https://docs.google.com/document/d/...",
          "favicon": "data:image/png;base64,...",
          "persisted": true,
          "activeMemory": true
        }
      ]
    },
    {
      "id": "ws-research",
      "name": "Research (temp)",
      "type": "workspace",
      "persisted": false,
      "activeMemory": false,
      "icon": "🔲",
      "createdAt": 1712329200000,
      "lastAccessedAt": 1712329200000,
      "children": []
    }
  ]
}
```

**snapshot-{workspace-id}.json**:
```json
{
  "workspaceId": "ws-project-alpha",
  "tabSnapshots": [
    {
      "url": "https://docs.google.com/document/d/...",
      "title": "Design Doc - Project Alpha",
      "favicon": "data:image/png;base64,...",
      "scrollPosition": { "x": 0, "y": 1200 },
      "formData": {
        "input#search": "optimization",
        "textarea#notes": "Consider performance..."
      },
      "localStorage": {
        "theme": "dark",
        "autoSave": "true"
      }
    }
  ],
  "metadata": {
    "capturedAt": 1712329200000,
    "browserVersion": "130.0.0"
  }
}
```

---

## 8. UI and UX: Workspace Tree View

### 8.1 Sidebar Layout

```
╔═══════════════════════════════════════╗
║ 🧩 WORKSPACES          [+]  [≡]  [v] ║  ← Header
╠═══════════════════════════════════════╣
║ Search workspaces...  [magnifying]    ║  ← Search bar
╠═══════════════════════════════════════╣
║                                       ║
║ ⭐🟢 Project Alpha                    ║  ← persisted + active
║   ├─ 🔴 Design Doc (tab)             ║  ← hot tier
║   ├─ 🟡 Code Review (tab)            ║  ← warm tier
║   └─ 🔵 Wiki Backup (tab)            ║  ← cool tier
║                                       ║
║ 📂 Research (temp)                    ║  ← temporary + dormant
║   ├─ Paper 1                         ║
║   ├─ Paper 2                         ║
║   └─ Notes (sub-workspace)           ║
║                                       ║
║ ⭐ Reading List                       ║  ← persisted + dormant
║   ├─ Article 1                       ║
║   └─ Article 2                       ║
║                                       ║
╠═══════════════════════════════════════╣
║ [Collapse All]  [Settings]            ║  ← Footer
╚═══════════════════════════════════════╝
```

### 8.2 Context Menu (Right-Click)

```
├─ Rename...
├─ New Tab
├─ New Sub-workspace
├─ ─────────────────
├─ Pin / Unpin (toggle persisted)
├─ Keep in Memory / Remove from Memory (toggle activeMemory)
├─ ─────────────────
├─ Duplicate
├─ Save as Template
├─ Move To...
├─ ─────────────────
├─ Close Workspace
├─ Force Close (no save)
├─ ─────────────────
├─ Properties / Details
└─ Delete
```

### 8.3 Drag-and-Drop Interaction

**Supported operations**:
1. **Reorder tabs within workspace**: Drag tab to new position
2. **Move tab between workspaces**: Drag tab onto target workspace (highlights drop zone)
3. **Move workspace**: Drag workspace folder to reparent
4. **Merge workspaces**: Drag workspace onto another workspace folder to merge

**Visual feedback**:
```
Before drag:
  ⭐🟢 Project A
  📂 Research

During drag (tab from Research to Project A):
  ⭐🟢 Project A  ← Drop zone highlights
     (+ drop here indicator)
  📂 Research
    ├─ Paper 1 (being dragged, semi-transparent)
```

### 8.4 Keyboard Shortcuts

```
Cmd/Ctrl + K              Open workspace switcher (fuzzy find)
Cmd/Ctrl + N              New workspace
Cmd/Ctrl + T              New tab in focused workspace
Cmd/Ctrl + Shift + T      Restore closed workspace
Cmd/Ctrl + W              Close focused tab/workspace
Cmd/Ctrl + Tab            Cycle next workspace
Cmd/Ctrl + Shift + Tab    Cycle previous workspace
Cmd/Ctrl + Alt + [1-9]    Jump to workspace N
F5 / Cmd + R              Refresh focused tab
Cmd/Ctrl + L              Focus address bar in focused tab
```

### 8.5 Search and Filter

**Sidebar search**:
- Real-time filtering of workspaces and tabs by name
- Includes dormant workspaces (marked with faded icon)
- Shows match count: "3 matches in 2 workspaces"

**Fuzzy find (Cmd/Ctrl + K)**:
- Search across all workspaces, tabs, and bookmarks
- Shows recent workspaces at top
- Navigate with arrow keys; select with Enter

---

## 9. Workspace Templates

### 9.1 Concept

Users can save a workspace structure as a reusable template:

```typescript
interface WorkspaceTemplate {
  id: string;
  name: string;                      // "Design Review Session"
  description: string;
  createdAt: number;

  // Template structure (no URLs, just layout)
  structure: {
    workspaceName: string;
    icon?: string;
    color?: string;
    children: (WorkspaceTemplate | TabTemplate)[];
  };
}

interface TabTemplate {
  name: string;
  url: string;  // Template URL (can include placeholders like ${project-id})
  icon?: string;
}
```

### 9.2 Usage

**Save as template**:
1. User right-clicks workspace → "Save as Template"
2. Dialog prompts for name, description
3. Template saved to `~/.config/chromium/workspace-templates/`

**Create from template**:
1. User right-clicks in sidebar → "Create from Template"
2. Select template from list
3. New workspace created with same structure (tabs are bookmarks, not open)
4. User can then open specific tabs as needed

### 9.3 Example: Daily Standup Template

```json
{
  "id": "tpl-daily-standup",
  "name": "Daily Standup",
  "structure": {
    "workspaceName": "Today's Standup",
    "icon": "📊",
    "children": [
      {
        "name": "Slack",
        "url": "https://slack.com"
      },
      {
        "name": "Jira Dashboard",
        "url": "https://jira.company.com/secure/RapidBoard.jspa?rapidView=1"
      },
      {
        "name": "Notes",
        "url": "https://docs.google.com/document/d/[PROJECT-NOTES]/edit"
      }
    ]
  }
}
```

---

## 10. Implementation Roadmap

### Phase 1: Core Data Model & Persistence (Weeks 1-2)

- [ ] Implement `WorkspaceNode` data structure
- [ ] Build persistence layer (SQLite + filesystem)
- [ ] Implement workspace tree load/save
- [ ] Unit tests for data model

### Phase 2: Process Model (Weeks 3-4)

- [ ] Create workspace process (utility process wrapper)
- [ ] Implement workspace process lifecycle
- [ ] Hook into Chromium's content layer for tab spawning
- [ ] Process hierarchy validation tests

### Phase 3: Memory Tier Management (Weeks 5-6)

- [ ] Implement four-tier memory model
- [ ] Build serialization logic (DOM snapshot, form data, cookies)
- [ ] State transition machinery (hot ↔ warm ↔ cool ↔ cold)
- [ ] Memory budget accounting and eviction

### Phase 4: UI/UX (Weeks 7-9)

- [ ] Sidebar tree view (HTML/CSS/JS)
- [ ] Visual indicators (icons, colors, badges)
- [ ] Context menus and keyboard shortcuts
- [ ] Drag-and-drop reordering

### Phase 5: Session Restore & Startup (Week 10)

- [ ] Implement graceful startup with workspace restoration
- [ ] Background restoration queuing
- [ ] Session state preservation
- [ ] Testing with various workspace configurations

### Phase 6: Polish & Performance (Weeks 11-12)

- [ ] Garbage collection implementation
- [ ] Performance profiling and tuning
- [ ] Edge case handling (process crashes, OOM, etc.)
- [ ] End-to-end integration tests

---

## 11. Appendix: Key Data Structures (TypeScript)

### Full WorkspaceNode Definition

```typescript
interface WorkspaceNode {
  // ─────── Identity & Hierarchy ───────
  id: string;                        // UUID v4
  name: string;                      // User-facing name
  parentId: string | null;           // NULL if root; enables O(1) parent lookup
  children: WorkspaceNode[];         // Child workspaces or tabs
  childOrder: string[];              // Child IDs in order (allows efficient reordering)

  // ─────── Type & Content ───────
  type: "workspace" | "tab";         // Folder or page
  url?: string;                      // (tab only) Full URL e.g., "https://example.com"
  title?: string;                    // (tab only) Page title from <title> tag
  favicon?: string;                  // (tab only) Data URI (e.g., "data:image/png;base64,...")

  // ─────── Persistence & Memory Flags ───────
  persisted: boolean;                // Saved to disk for next session?
  activeMemory: boolean;             // Pre-loaded in cache (warm/hot tier)?

  // ─────── Lifecycle ───────
  isActive: boolean;                 // Currently focused/visible?
  memoryTier: "hot" | "warm" | "cool" | "cold";
  processId?: number;                // (workspace only) PID of workspace subprocess
  tabProcessIds?: Map<string, number>;  // (workspace only) Map of tab ID → process PID

  // ─────── Timestamps ───────
  createdAt: number;                 // Unix ms; immutable
  lastAccessedAt: number;            // Unix ms; updated on focus/activation
  lastModifiedAt: number;            // Unix ms; updated on structure change

  // ─────── State Snapshot ───────
  serializedState?: WorkspaceSnapshot;  // Cached serialization (warm/cool tiers)

  // ─────── Metadata & Styling ───────
  icon?: string;                     // Emoji or icon ID (e.g., "📁", "🚀")
  color?: string;                    // Hex color or CSS color name (e.g., "blue", "#00ffff")
  tags?: string[];                   // User-defined tags for filtering
  template?: boolean;                // Is this a workspace template?
}

interface WorkspaceSnapshot {
  workspaceId: string;
  tabSnapshots: TabSnapshot[];
  metadata: {
    capturedAt: number;              // Unix ms
    browserVersion: string;
  };
}

interface TabSnapshot {
  url: string;
  title: string;
  favicon: string;                   // Data URI
  scrollPosition: { x: number; y: number };
  formData: Record<string, string>;  // Serialized form inputs
  cookies: string[];                 // Relevant cookies for domain
  localStorage: Record<string, string>;  // Serialized localStorage
}

interface MemoryTierConfig {
  hotToWarmTimeout: number;          // Default: 5 minutes (300,000 ms)
  warmToCoolTimeout: number;         // Default: 30 minutes (1,800,000 ms)
  coolToGarbageTimeout: number;      // Default: 24 hours (temp workspaces only)

  hotBudgetBytes: number;            // Default: 600 MB
  warmBudgetBytes: number;           // Default: 600 MB
  coolBudgetBytes: number;           // Default: 500 MB

  evictionPolicy: "LRU" | "FIFO";    // Default: LRU
  activeCachingStrategy: "preload" | "lazy";  // Default: "preload"
}
```

### Memory Accounting

```typescript
interface WorkspaceMemoryUsage {
  workspaceId: string;
  tier: "hot" | "warm" | "cool" | "cold";

  // Breakdown (bytes)
  processMemory: number;             // Renderer process resident set
  domMemory: number;                 // DOM tree + CSS (warm/hot tiers)
  javascriptHeap: number;            // V8 heap (hot tier only)
  diskSnapshot: number;              // Size of serialized snapshot on disk

  tabCount: number;
  childWorkspaceCount: number;

  // Rollups
  totalMemoryBytes: number;          // Sum of all above (RAM only)
  totalDiskBytes: number;            // Snapshot size on disk
}

interface BrowserMemoryBudget {
  total: number;                     // Total budget (bytes)
  hotUsed: number;
  warmUsed: number;
  coolUsed: number;
  staticUsed: number;
  reserved: number;

  // Projected state
  hotAvailable: number;              // hotBudget - hotUsed
  warmAvailable: number;             // warmBudget - warmUsed

  // Pressure threshold
  pressureThreshold: 0.85;           // Trigger eviction at 85% utilization
  isCritical: boolean;               // true if > pressureThreshold
}
```

---

## 12. Revision History

| Version | Date       | Author | Changes |
|---------|------------|--------|---------|
| 1.0     | 2026-04-04 | N/A    | Initial architecture design specification |

---

## 13. References & Related Concepts

- **Chromium Process Model**: https://chromium.googlesource.com/chromium/src/+/main/docs/process_model.md
- **Tab Freezing / Tab Discard**: https://bugs.chromium.org/p/chromium/issues/detail?id=1163424
- **Memory Pressure**: https://source.chromium.org/chromium/chromium/src/+/main/base/memory/memory_pressure_listener.h
- **Ungoogled-Chromium**: https://github.com/ungoogled-software/ungoogled-chromium
- **MCP (Model Context Protocol)**: Local-first agent integration
- **VS Code Explorer**: File tree UX inspiration

---

**End of Document**
