# Workspace Model Technical Architecture

**Document Type**: Technical Deep-Dive | **Audience**: Chromium Engineers | **Status**: Proposal

## System Overview

The Workspace Model replaces the traditional flat tab model with a hierarchical tree-based system that unifies workspaces, tabs, and bookmarks into a single abstraction. The system spans three layers: **data**, **process**, and **memory**.

```
┌──────────────────────────────────────────────────────────────────┐
│ User-Visible Layer (Sidebar UI)                                  │
│                                                                  │
│  Workspaces Tree          ⭐🟢 Project Alpha                    │
│  (VS Code Explorer)       ├─ 🔴 Tab 1 (Hot)                    │
│                           ├─ 🟡 Tab 2 (Warm)                   │
│                           └─ 📁 Sub-workspace                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                 ↓
┌──────────────────────────────────────────────────────────────────┐
│ Data Model Layer (WorkspaceModel & WorkspaceNode Tree)           │
│                                                                  │
│  WorkspaceModel (singleton)                                     │
│  ├─ Manages WorkspaceNode tree                                  │
│  ├─ CRUD operations on nodes                                    │
│  ├─ Observer pattern for UI updates                             │
│  └─ Lookup by UUID for O(1) access                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                 ↓
┌──────────────────────────────────────────────────────────────────┐
│ Process Layer (WorkspaceProcessHost & RenderProcessHostImpl)      │
│                                                                  │
│  WorkspaceProcessManager (singleton)                            │
│  ├─ Spawns/terminates WorkspaceProcessHost per workspace       │
│  └─ Coordinates memory pressure across workspaces              │
│                                                                  │
│  WorkspaceProcessHost (1 per workspace folder)                  │
│  ├─ Supervises child tab renderers                             │
│  └─ Handles lifecycle for workspace and children               │
│                                                                  │
│  RenderProcessHostImpl (1 per tab, workspace-aware)             │
│  ├─ Inherits workspace UUID via SiteInstance                   │
│  └─ Reports memory usage to parent WorkspaceProcessHost        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                                 ↓
┌──────────────────────────────────────────────────────────────────┐
│ Memory Management Layer (WorkspaceMemoryManager & Tiers)         │
│                                                                  │
│  WorkspaceMemoryManager (singleton)                             │
│  ├─ Memory budget allocation per tier (hot/warm/cool/cold)     │
│  ├─ Monitor memory pressure; trigger promotions/demotions      │
│  └─ Persist tier state to disk for session restore             │
│                                                                  │
│  MemoryTierTransition (utilities)                               │
│  ├─ FreezeTabDOM (hot → warm)                                   │
│  ├─ SerializeTabState (warm → cool)                             │
│  ├─ DiscardRenderer (cool → cold)                               │
│  └─ RestoreFromState (cool/cold → hot)                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. WorkspaceNode (Data Model)

**Responsibility**: Atomic unit representing either a workspace folder or a tab (page). Carries all metadata, hierarchy, persistence flags, and memory tier state.

**Input**: None (created by caller; immutable identity, mutable state)
**Output**: Serializable JSON; observer notifications on state change

**Key Fields**:
```cpp
// Identity & Hierarchy
UUID id;                              // Immutable, globally unique
string title;                          // Display name
WorkspaceNodeType type;               // "workspace" or "tab"
WorkspaceNode* parent;                // Parent node (null for root)
vector<unique_ptr<WorkspaceNode>> children;

// Persistence & Memory
bool persisted;                        // Survives restart?
bool active_memory;                    // Pre-loaded in memory?
MemoryTier memory_tier;               // hot|warm|cool|cold

// Tab-specific
GURL url;                              // Tab URL
string title;                          // <title> tag
string favicon_url;                    // Favicon

// Process Association
int workspace_process_id;              // Parent workspace subprocess PID
int renderer_process_id;               // This tab's renderer PID

// Metadata
base::Time creation_time;
base::Time last_active_time;           // For LRU eviction
```

**Performance Targets**:
- Tree traversal (find node by UUID): O(1) via hash map lookup
- Serialization to JSON: <10ms for 1000 nodes
- Tree modification (add/remove child): O(1) amortized

---

### 2. WorkspaceModel (CRUD & Observation)

**Responsibility**: Singleton managing the entire workspace tree. Provides CRUD operations, observers, and lookups.

**Input**: Tree mutation requests (create workspace, add tab, etc.); observer subscriptions
**Output**: Notifications to observers; serialized tree on demand

**Key Operations**:
```cpp
// Workspace operations
WorkspaceNode* CreateWorkspace(const string& title);
void RemoveWorkspace(const UUID& workspace_id);
WorkspaceNode* GetWorkspaceById(const UUID& id);
const vector<unique_ptr<WorkspaceNode>>& GetAllWorkspaces() const;

// Tab operations
WorkspaceNode* CreateTab(const UUID& workspace_id, const GURL& url, const string& title);
void RemoveTab(const UUID& workspace_id, const UUID& tab_id);

// Memory & Persistence
void SetMemoryTier(const UUID& node_id, MemoryTier tier);
void SetWorkspacePersisted(const UUID& workspace_id, bool persisted);
void SetWorkspaceActiveMemory(const UUID& workspace_id, bool active);

// Lookups
WorkspaceNode* FindNodeById(const UUID& id);
WorkspaceNode* FindParentWorkspace(const UUID& node_id);
```

**Observer Interface**:
```cpp
class WorkspaceModelObserver {
  virtual void OnWorkspaceAdded(WorkspaceNode* workspace) {}
  virtual void OnWorkspaceRemoved(const UUID& workspace_id) {}
  virtual void OnTabAdded(WorkspaceNode* workspace, WorkspaceNode* tab) {}
  virtual void OnMemoryTierChanged(WorkspaceNode* node, MemoryTier old_tier, MemoryTier new_tier) {}
};
```

**Performance Targets**:
- CRUD operations: O(1) to O(log n) depending on tree depth
- Observer notifications: Batch updates when possible to minimize UI redraws
- Serialization (full tree): <100ms for typical ~500-node tree

---

### 3. WorkspaceProcessHost (Per-Workspace Broker)

**Responsibility**: Manages lifecycle and supervision of a single workspace's subprocess and its child tab renderers. Acts as a broker between the browser process and workspace-scoped renderer processes.

**Input**: Tab creation requests; memory pressure signals; IPC from child renderers
**Output**: Process lifecycle events; memory usage telemetry

**Key Responsibilities**:
```cpp
class WorkspaceProcessHost : public BrowserChildProcessHostDelegate {
  // Lifecycle
  bool Start();                        // Spawn the workspace subprocess
  void OnProcessLaunched() override;
  void OnProcessCrashed(int exit_code) override;

  // Child tab management
  void RegisterTabProcess(int tab_id, int renderer_pid);
  void UnregisterTabProcess(int tab_id);

  // Memory management
  void OnTabMemoryPressure(int tab_id, MemoryPressureLevel level);

  // Queries
  int GetProcessId() const;
  const UUID& GetWorkspaceUuid() const;
  const vector<int>& GetChildTabPids() const;
};
```

**Process Lifecycle**:

```
1. Creation (User creates workspace)
   ↓
2. Dormant (No subprocess yet)
   ↓
3. Activation (First tab added or activeMemory toggled)
   ↓
4. Running (Workspace subprocess active, supervises child tabs)
   ↓
5. Crash (Workspace subprocess crashes)
   ├─ Orphaned tabs migrated to temporary workspace
   ├─ Automatic respawn with exponential backoff
   └─ User notified of crash if workspace is in focus
   ↓
6. Termination (User closes workspace or browser shuts down)
```

**IPC Message Types**:
- `WorkspaceMsg_RegisterTab`: Child tab renderer registers with workspace
- `WorkspaceMsg_UnregisterTab`: Child tab renderer unregisters
- `WorkspaceMsg_MemoryUsage`: Tab reports memory consumption
- `WorkspaceMsg_TierChangeRequest`: Workspace asks browser to demote/promote tier

---

### 4. WorkspaceProcessManager (Singleton)

**Responsibility**: Global registry of all WorkspaceProcessHost instances. Creates, destroys, and coordinates workspace processes.

**Input**: Workspace creation/deletion requests; memory pressure signals
**Output**: WorkspaceProcessHost lookup; lifecycle events

**Key Operations**:
```cpp
class WorkspaceProcessManager {
  static WorkspaceProcessManager* GetInstance();

  WorkspaceProcessHost* GetOrCreateWorkspaceProcess(const UUID& workspace_uuid);
  void TerminateWorkspaceProcess(const UUID& workspace_uuid);
  WorkspaceProcessHost* GetWorkspaceProcess(const UUID& workspace_uuid);
};
```

**Memory Pressure Coordination**:
- Monitors system memory via MemoryCoordinator
- Broadcasts pressure levels to all WorkspaceProcessHost instances
- Each host independently demotes tiers based on workspace policy
- Global fallback: if memory remains high, demote coldest tiers across all workspaces

---

### 5. WorkspaceMemoryManager (Tiered Memory)

**Responsibility**: Manages memory budget allocation across the four tiers. Monitors memory consumption and triggers tier transitions based on policy.

**Input**: Tier change requests; memory usage reports from tabs; memory pressure events
**Output**: Tier promotion/demotion decisions; memory budget notifications

**Architecture**:

```
Memory Budget Distribution (2 GB total):

┌─────────────────────────────────────────────────────────┐
│ Hot (30%, 600 MB)                    [Primary: 200MB]   │
│ - Full renderer processes             [Secondary: 400MB] │
│ - <50ms activation latency                               │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Warm (30%, 600 MB)                                       │
│ - DOM snapshots cached in memory                         │
│ - ~300-500ms activation latency                          │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Cool (25%, 500 MB)                                       │
│ - Serialized state on disk                              │
│ - Metadata cache in RAM (~50MB)                          │
│ - ~1-2s activation latency                               │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ Cold (Unbounded)                                         │
│ - URL-only references (minimal memory)                  │
│ - ~2-5s activation latency                               │
└─────────────────────────────────────────────────────────┘
```

**Key Operations**:
```cpp
class WorkspaceMemoryManager {
  // Configuration
  void SetWorkspaceMemoryBudget(const UUID& workspace_id, uint64_t budget_bytes);

  // Tier management
  void SetTabMemoryTier(const UUID& tab_id, const UUID& workspace_id, MemoryTier tier);
  MemoryTier GetTabMemoryTier(const UUID& tab_id);

  // Monitoring
  uint64_t GetWorkspaceMemoryUsage(const UUID& workspace_id);
  bool ShouldPreLoadWorkspace(const UUID& workspace_id);  // activeMemory check
};
```

**Tier Transition Logic**:

| Trigger | Action | Latency | Memory Savings |
|---|---|---|---|
| Hot → Warm (timeout) | Freeze renderer, persist DOM | 100ms | ~100-130 MB |
| Warm → Cool (memory pressure) | Serialize to disk, free memory | 50ms | ~550 MB |
| Cool → Cold (timeout) | Delete serialized state | Immediate | ~5 MB |
| Cold → Warm (user activation) | Spawn process, deserialize state | 500ms | ~20-50 MB |

---

### 6. MemoryTierTransition (Utilities)

**Responsibility**: Implement the actual transitions between memory tiers. Abstracts away the complexity of freezing renderers, serializing state, and restoring processes.

**Input**: WebContents instance; source and target memory tier
**Output**: Asynchronous completion callback

**Key Methods**:
```cpp
class MemoryTierTransition {
  // Hot → Warm: Freeze JS, keep DOM
  static void FreezeTabDOM(content::WebContents* web_contents);

  // Warm → Cool: Serialize state to disk
  static void SerializeTabState(content::WebContents* web_contents);

  // Cool → Cold: Discard serialized state, keep URL
  static void DiscardRenderer(content::WebContents* web_contents);

  // Cool/Cold → Warm/Hot: Restore from state
  static void RestoreFromState(content::WebContents* web_contents);
  static void ReloadFromURL(content::WebContents* web_contents);
};
```

**Performance Targets**:
- `FreezeTabDOM`: <100ms (coordinate with RenderWidgetHost)
- `SerializeTabState`: <50ms (async I/O to disk)
- `RestoreFromState`: <300ms (deserialize and restore JS context)
- `ReloadFromURL`: ~2-5s (depends on network)

---

## Data Flow: Primary User-Facing Scenarios

### Scenario 1: Create and Activate a Workspace

**Steps**:

1. **User clicks "New Workspace" in UI**
   - UI calls `WorkspaceModel::CreateWorkspace("My Project")`
   - WorkspaceModel allocates new WorkspaceNode (id=UUID, type=workspace)
   - Node is NOT persisted (persisted=false), not in active memory (activeMemory=false)
   - Memory tier set to COLD

2. **WorkspaceModel notifies observers**
   - `OnWorkspaceAdded(workspace_node)` fired
   - Sidebar UI refreshes, shows new workspace with translucent icon

3. **User adds first tab to workspace**
   - User presses Ctrl+T inside workspace context
   - UI calls `WorkspaceModel::CreateTab(workspace_uuid, GURL, "New Tab")`
   - WorkspaceModel adds WorkspaceNode with type=tab

4. **Tab creation triggers process spawning**
   - `TabStripModel` (or equivalent) detects workspace association
   - Calls `WorkspaceProcessManager::GetOrCreateWorkspaceProcess(workspace_uuid)`
   - Manager spawns `WorkspaceProcessHost`; workspace process starts

5. **Tab renderer spawned**
   - Browser process creates `RenderProcessHostImpl`
   - Sets workspace UUID via `SetAssociatedWorkspace(workspace_uuid)`
   - Renderer process registers with parent `WorkspaceProcessHost`
   - Tab memory tier promoted to HOT

6. **User navigates in tab**
   - Page loads; JS executes; user interacts
   - Memory consumption tracked by `WorkspaceMemoryManager`

7. **User switches to another workspace (idle timeout)**
   - Current tab not accessed for 5 minutes
   - `WorkspaceMemoryManager` demotes HOT → WARM
   - `MemoryTierTransition::FreezeTabDOM()` called
   - DOM snapshot persisted to memory, JS frozen
   - Process remains alive but idle

---

### Scenario 2: Restore a Persisted Workspace on Browser Restart

**Steps**:

1. **Browser shutdown**
   - `SessionService::SaveWorkspaceState()` called for each workspace
   - Workspaces with `persisted=true` serialized to disk (JSON)
   - Includes `activeMemory` flag, memory tier, tab URLs

2. **Browser startup**
   - `SessionService::RestoreSession()` loads saved workspaces from disk
   - For each persisted workspace:
     - If `activeMemory=true`: Create workspace, restore tabs in WARM tier
     - If `activeMemory=false`: Create workspace, set tabs to COLD tier
   - Non-persisted workspaces are discarded

3. **UI renders restored workspaces**
   - Sidebar populated with workspace tree
   - Persisted workspaces shown with solid icons (⭐)
   - Active-memory workspaces shown with green pulsing indicator (🟢)

4. **User clicks on warm workspace**
   - `WorkspaceMemoryManager` checks if tab is in WARM tier
   - Calls `MemoryTierTransition::RestoreFromState(web_contents)`
   - DOM snapshot deserialized, JS context restored
   - Process spawned if not already alive
   - Tab transitions WARM → HOT

---

### Scenario 3: Memory Pressure Event

**Steps**:

1. **System memory pressure detected**
   - OS signals low memory (e.g., <20% free)
   - `MemoryCoordinator` broadcasts `MemoryPressureLevel::MODERATE` to all components

2. **WorkspaceMemoryManager receives pressure signal**
   - Queries current memory usage per workspace
   - Calculates deficit: (total_usage - budget) / budget
   - If deficit > 10%, trigger demotion cascade

3. **Demotion cascade (in priority order)**
   - **Priority 1**: Demote least-recently-used HOT tabs → WARM
     - `MemoryTierTransition::FreezeTabDOM()` for each LRU tab
     - Savings: ~100-130 MB per tab
   - **Priority 2**: Demote least-recently-used WARM tabs → COOL
     - `MemoryTierTransition::SerializeTabState()` for each LRU tab
     - Free memory, write to disk
     - Savings: ~550 MB per tab

4. **Observer notifications**
   - `OnMemoryTierChanged(tab_node, HOT, WARM)` fired
   - Sidebar updates, showing color change (red → yellow)

5. **User clicks on demoted tab**
   - Tab in WARM tier: Restores in ~300-500ms
   - Tab in COOL tier: Restores in ~1-2s
   - User sees loading indicator during restore

---

## Integration Points

### TabStripModel Integration

**Current State**: TabStripModel manages flat list of tabs, groups (TabGroupModel).

**New State**:
- TabStripModel continues to exist for backward compatibility
- New code delegates group operations to `WorkspaceModel`
- Migration: Existing tab groups auto-convert to persisted workspaces on first launch
- Coexistence: Feature-flagged via `kWorkspaceModel` during transition

```cpp
// In TabStripModel
std::unique_ptr<workspaces::WorkspaceModel> workspace_model_;

public:
  workspaces::WorkspaceModel* workspace_model() { return workspace_model_.get(); }
```

### Session Restore Integration

**Current State**: SessionService saves/restores tab list and groups.

**New State**:
- SessionService extended to understand `persisted` and `activeMemory` flags
- Workspace tree serialized alongside existing session data
- Restoration logic respects memory tier hints

```cpp
void SessionService::BuildRestoredWorkspaces(
    vector<unique_ptr<workspaces::WorkspaceNode>>* restored);

void SessionService::RestoreSession() {
  auto workspace_tree = workspace_storage_->LoadWorkspaceTree();
  // For each persisted workspace:
  // - If activeMemory: restore tabs to WARM tier, spawn processes
  // - If !activeMemory: restore tabs to COLD tier, defer spawning
}
```

### Resource Coordinator Integration

**Current State**: TabManager tracks tab lifecycle for discard decisions (based on LRU, importance).

**New State**:
- TabManager extended with workspace awareness
- Discard decisions consider workspace memory budget constraints
- WorkspaceMemoryManager coordinates with TabManager for tier transitions

```cpp
class TabManager {
  std::unique_ptr<WorkspaceMemoryManager> workspace_memory_manager_;

  TabLifecycleUnit* GetTabToDiscard(
      content::WebContents* new_tab,
      const UUID* preferred_workspace_id = nullptr) override;
};
```

### Side Panel Integration

**Current State**: Side panels exist for bookmarks, history, search.

**New State**:
- New `WorkspaceSidePanel` implements VS Code-like tree explorer
- Registers as a side panel entry (SidePanelEntryId::kWorkspace)
- Uses `WorkspaceTreeModel` adapter to present WorkspaceModel tree as a UI::TreeView

```cpp
auto workspace_entry = make_unique<SidePanelEntry>(
    SidePanelEntryId::kWorkspace,
    u"Workspaces",
    ui::ImageModel::FromVectorIcon(vector_icons::kFolderIcon, ui::kColorIcon),
    base::BindRepeating(&CreateWorkspaceSidePanel, browser));
side_panel->AddEntry(move(workspace_entry));
```

### Task Manager Integration

**Current State**: Task Manager shows flat list of processes.

**New State**:
- Task Manager displays hierarchical workspace tree
- Each workspace shows as a parent entry with child tab tasks
- "End Workspace" action terminates WorkspaceProcessHost and orphaned tabs migrate to temp workspace

---

## Security Model

### Trust Boundaries

1. **Browser Process ↔ Workspace Process**: Standard Chromium IPC with message validation
   - Workspace process is a utility process (lower privilege than content process)
   - All memory tier transitions validated in browser process
   - No direct access to filesystem

2. **Workspace Process ↔ Child Tab Renderers**: Standard Chromium renderer isolation
   - Each tab renderer in separate process (or shared under site-instance rules)
   - Workspace process acts as coordinator, not execution context

3. **Disk Storage (Workspace Snapshots)**: Serialized state written to user profile directory
   - Permissions: Owner-readable only (0600)
   - Content: JSON serialized, no raw pointers or heap dumps
   - Validation: On restore, check version, browser version, integrity

### Potential Attack Surfaces

| Surface | Risk | Mitigation |
|---|---|---|
| Malicious tab escapes to parent process | Code injection | Standard renderer sandbox; workspace process is utility (lower privilege) |
| Workspace process DoS via memory exhaustion | Memory bomb | Memory budgets enforced; tier demotion on pressure |
| Serialized state on disk tampered | Privilege escalation | File permissions; content validation on restore |
| IPC message fuzzing | Crash/exploit | Standard Chromium message validation; fuzzing coverage |

---

## Open Questions

1. **Workspace Sync**: Should persisted workspaces sync across devices via Google Account? (Recommended: Phase 2; local-only in v1)
2. **Shared Workspaces**: Can workspaces be shared with team members? (Recommended: Phase 3)
3. **Mobile Support**: Should workspace tree sync to mobile browsers? (Recommended: Phase 3)
4. **Import from Arc**: Should Arc spaces auto-import as persisted workspaces? (Recommended: Phase 2)
5. **Backward Compatibility with Bookmarks**: How do existing bookmarks map to workspace tree? (Recommended: Create single "Imported Bookmarks" workspace)

---

## Performance Considerations

### Critical Paths (Target <100ms)

- Create workspace: WorkspaceModel allocation + observer notification
- Add tab to workspace: Node creation + process registration (if workspace not yet live)
- Tier demotion (HOT → WARM): DOM freezing + snapshot serialization

### Non-Critical Paths (Target <1s)

- Restore workspace from WARM: Deserialize DOM + restore JS context
- Restore workspace from COOL: Load from disk + spawn process

### Baseline Metrics

| Operation | Target | Notes |
|---|---|---|
| Tree traversal (O(log n)) | <1ms | Hash map lookup via UUID |
| Serialize 500-node tree | <100ms | JSON serialization |
| Tier demotion (hot → warm) | <100ms | DOM freezing |
| Tier demotion (warm → cool) | <50ms | Async I/O |
| Restore from warm | <300ms | Deserialize + restore JS |
| Restore from cold | ~2-5s | Network reload |

---

**Document Version**: 1.0
**Last Updated**: 2026-04-04
**Related Files**: workspace-architecture.md, chromium-implementation-notes.md
