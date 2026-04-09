# Chromium Workspace Implementation Guide

**Last Updated:** April 2026
**Target Chromium Version:** Chromium 130+
**Complexity Level:** Advanced (touches multiple subsystems)

## Overview

This guide documents patch-level implementation details for integrating a unified "Workspace" concept into Chromium. Workspaces merge tab groups, bookmarks, and process/memory management into a single hierarchical model, replacing the current dual-system approach.

**Key Goals:**
- Single tree-based UI (VS Code style sidebar)
- Workspace-level subprocess management
- Tiered memory caching (hot/warm/cool/cold)
- Persistent workspaces (like bookmarks) + ephemeral workspaces (like open tabs)

---

## Implementation Order (Critical Sequencing)

1. **Phase 1:** Data Model (WorkspaceModel, WorkspaceNode) — no UI/process changes yet
2. **Phase 2:** Process Architecture (WorkspaceProcess definition, process assignment)
3. **Phase 3:** Memory Management (tier system, workspace-aware lifecycle)
4. **Phase 4:** UI (sidebar, tree view)
5. **Phase 5:** Session Restore (persistence, serialization)
6. **Phase 6:** Integration (task manager, sync compatibility)

This ordering ensures each layer can be tested in isolation before introducing cross-layer dependencies.

---

## Phase 1: Data Model (WorkspaceModel & WorkspaceNode)

### 1.1 Create Core Data Structures

**New File:** `chrome/browser/workspaces/workspace_node.h`

```cpp
// Header for the unified workspace/bookmark/tab-group data structure
#ifndef CHROME_BROWSER_WORKSPACES_WORKSPACE_NODE_H_
#define CHROME_BROWSER_WORKSPACES_WORKSPACE_NODE_H_

#include <vector>
#include <string>
#include <memory>
#include "base/uuid.h"
#include "base/time/time.h"
#include "url/gurl.h"

namespace workspaces {

enum class WorkspaceNodeType {
  kWorkspace,      // Root node, contains tabs/bookmarks
  kTab,            // A tab within a workspace
  kBookmark,       // A bookmark folder (may contain tabs or bookmarks)
  kSeparator,      // Visual separator
};

enum class MemoryTier {
  kHot,   // Full renderer, DOM active
  kWarm,  // Frozen DOM snapshot, serialized state
  kCool,  // Serialized state only, no DOM
  kCold,  // URL and metadata only
};

// Core workspace node structure
class WorkspaceNode {
 public:
  WorkspaceNode();
  explicit WorkspaceNode(const std::string& title, WorkspaceNodeType type);
  ~WorkspaceNode();

  // Identity
  const base::Uuid& id() const { return id_; }
  const std::string& title() const { return title_; }
  void set_title(const std::string& title) { title_ = title; }
  WorkspaceNodeType type() const { return type_; }

  // Persistence & Memory Flags
  bool persisted() const { return persisted_; }
  void set_persisted(bool value) { persisted_ = value; }

  bool active_memory() const { return active_memory_; }
  void set_active_memory(bool value) { active_memory_ = value; }

  MemoryTier memory_tier() const { return memory_tier_; }
  void set_memory_tier(MemoryTier tier) { memory_tier_ = tier; }

  // Process Association
  int workspace_process_id() const { return workspace_process_id_; }
  void set_workspace_process_id(int pid) { workspace_process_id_ = pid; }

  // For tabs: the renderer process ID
  int renderer_process_id() const { return renderer_process_id_; }
  void set_renderer_process_id(int pid) { renderer_process_id_ = pid; }

  // Tree Structure
  WorkspaceNode* parent() const { return parent_; }
  const std::vector<std::unique_ptr<WorkspaceNode>>& children() const {
    return children_;
  }
  void AddChild(std::unique_ptr<WorkspaceNode> child);
  void RemoveChild(WorkspaceNode* child);
  WorkspaceNode* GetChild(size_t index) const;
  size_t GetChildCount() const { return children_.size(); }

  // Content (for tabs/bookmarks)
  const GURL& url() const { return url_; }
  void set_url(const GURL& url) { url_ = url; }

  const std::string& favicon_url() const { return favicon_url_; }
  void set_favicon_url(const std::string& url) { favicon_url_ = url; }

  // Metadata
  base::Time creation_time() const { return creation_time_; }
  base::Time last_active_time() const { return last_active_time_; }
  void set_last_active_time(base::Time time) { last_active_time_ = time; }

  // Serialization (for sync, session restore)
  std::string SerializeToJSON() const;
  static std::unique_ptr<WorkspaceNode> DeserializeFromJSON(
      const std::string& json);

  // Clone (deep copy)
  std::unique_ptr<WorkspaceNode> Clone() const;

 private:
  base::Uuid id_;
  std::string title_;
  WorkspaceNodeType type_;
  bool persisted_ = false;
  bool active_memory_ = false;
  MemoryTier memory_tier_ = MemoryTier::kCold;

  int workspace_process_id_ = -1;  // -1 = not yet assigned
  int renderer_process_id_ = -1;

  GURL url_;
  std::string favicon_url_;

  WorkspaceNode* parent_ = nullptr;  // weak ref
  std::vector<std::unique_ptr<WorkspaceNode>> children_;

  base::Time creation_time_;
  base::Time last_active_time_;
};

}  // namespace workspaces

#endif
```

**New File:** `chrome/browser/workspaces/workspace_node.cc`

Implement constructors, tree operations (AddChild, RemoveChild), serialization stubs (to be detailed in Phase 5).

**New File:** `chrome/browser/workspaces/workspace_model.h`

```cpp
#ifndef CHROME_BROWSER_WORKSPACES_WORKSPACE_MODEL_H_
#define CHROME_BROWSER_WORKSPACES_WORKSPACE_MODEL_H_

#include <vector>
#include <memory>
#include <map>
#include "base/observer_list.h"
#include "base/uuid.h"
#include "chrome/browser/workspaces/workspace_node.h"

namespace workspaces {

// Observer interface for workspace model changes
class WorkspaceModelObserver {
 public:
  virtual ~WorkspaceModelObserver() = default;

  virtual void OnWorkspaceAdded(WorkspaceNode* workspace) {}
  virtual void OnWorkspaceRemoved(const base::Uuid& workspace_id) {}
  virtual void OnWorkspaceRenamed(WorkspaceNode* workspace,
                                   const std::string& old_title) {}
  virtual void OnTabAdded(WorkspaceNode* workspace, WorkspaceNode* tab) {}
  virtual void OnTabRemoved(WorkspaceNode* workspace, const base::Uuid& tab_id) {}
  virtual void OnMemoryTierChanged(WorkspaceNode* workspace_or_tab,
                                    MemoryTier old_tier,
                                    MemoryTier new_tier) {}
};

// Central workspace model, replaces both TabStripModel and BookmarkModel
// for workspace/group operations
class WorkspaceModel {
 public:
  WorkspaceModel();
  ~WorkspaceModel();

  // Root workspace operations
  WorkspaceNode* CreateWorkspace(const std::string& title);
  void RemoveWorkspace(const base::Uuid& workspace_id);
  WorkspaceNode* GetWorkspaceById(const base::Uuid& id);
  const std::vector<std::unique_ptr<WorkspaceNode>>& GetAllWorkspaces() const {
    return workspaces_;
  }

  // Tab operations within a workspace
  WorkspaceNode* CreateTab(const base::Uuid& workspace_id,
                            const GURL& url,
                            const std::string& title);
  void RemoveTab(const base::Uuid& workspace_id, const base::Uuid& tab_id);
  WorkspaceNode* GetTabById(const base::Uuid& tab_id);

  // Bookmark folder operations (stored as persistent workspaces/sub-nodes)
  WorkspaceNode* CreateBookmarkFolder(
      const base::Uuid& parent_workspace_id,
      const std::string& title);

  // Memory tier management
  void SetMemoryTier(const base::Uuid& node_id, MemoryTier tier);
  void SetWorkspaceActiveMemory(const base::Uuid& workspace_id, bool active);

  // Persistence flag
  void SetWorkspacePersisted(const base::Uuid& workspace_id, bool persisted);

  // Observer management
  void AddObserver(WorkspaceModelObserver* observer);
  void RemoveObserver(WorkspaceModelObserver* observer);

  // Lookups
  WorkspaceNode* FindNodeById(const base::Uuid& id);
  WorkspaceNode* FindParentWorkspace(const base::Uuid& node_id);

 private:
  void NotifyWorkspaceAdded(WorkspaceNode* workspace);
  void NotifyWorkspaceRemoved(const base::Uuid& workspace_id);
  void NotifyTabAdded(WorkspaceNode* workspace, WorkspaceNode* tab);
  void NotifyMemoryTierChanged(WorkspaceNode* node, MemoryTier old_tier);

  std::vector<std::unique_ptr<WorkspaceNode>> workspaces_;
  std::map<base::Uuid, WorkspaceNode*> id_to_node_;  // weak refs for fast lookup

  base::ObserverList<WorkspaceModelObserver> observers_;
};

}  // namespace workspaces

#endif
```

**Implement** `workspace_model.cc` with tree navigation and observer notification logic.

### 1.2 Integrate with Existing TabStripModel

**File:** `chrome/browser/ui/tabs/tab_strip_model.h`

Add a new member to TabStripModel:

```cpp
// In TabStripModel class definition
private:
  std::unique_ptr<workspaces::WorkspaceModel> workspace_model_;

public:
  // Delegate some group operations to WorkspaceModel
  workspaces::WorkspaceModel* workspace_model() { return workspace_model_.get(); }
  const workspaces::WorkspaceModel* workspace_model() const {
    return workspace_model_.get();
  }
```

**File:** `chrome/browser/ui/tabs/tab_group_model.h`

Add deprecation notice and delegation:

```cpp
// DEPRECATED: Use WorkspaceModel for group management going forward
// TabGroupModel will be kept for backward compatibility during migration
// New code should use workspace_model()->CreateWorkspace() etc.
```

**Rationale:** This allows coexistence during the migration phase. Old code can still use TabGroupModel, but new code uses WorkspaceModel.

### 1.3 GN Build Configuration

**File:** `chrome/browser/workspaces/BUILD.gn`

```python
source_set("workspaces") {
  sources = [
    "workspace_node.h",
    "workspace_node.cc",
    "workspace_model.h",
    "workspace_model.cc",
  ]

  deps = [
    "//base",
    "//url",
    "//components/bookmarks/browser",
  ]

  public_deps = [
    "//base:uuid",
  ]
}
```

**File:** `chrome/browser/BUILD.gn`

Add the workspaces dependency to the main chrome target.

---

## Phase 2: Process Architecture (WorkspaceProcess)

### 2.1 Define WorkspaceProcess Type

**File:** `content/public/common/process_type.h`

Add a new process type:

```cpp
enum ProcessType {
  PROCESS_TYPE_BROWSER,
  PROCESS_TYPE_RENDERER,
  PROCESS_TYPE_PLUGIN,
  PROCESS_TYPE_UTILITY,
  PROCESS_TYPE_ZYGOTE,
  PROCESS_TYPE_SANDBOX_HELPER,
  PROCESS_TYPE_PPAPI_PLUGIN,
  PROCESS_TYPE_PPAPI_BROKER,
  PROCESS_TYPE_NACL_LOADER,
  PROCESS_TYPE_NACL_BROKER,
  PROCESS_TYPE_GPU,
  PROCESS_TYPE_EXTENSION,
  PROCESS_TYPE_WATCHER,
  PROCESS_TYPE_LAUNCHER,
  PROCESS_TYPE_WORKSPACE,  // NEW: Workspace process broker
  PROCESS_TYPE_MAX
};

inline const char* GetProcessTypeName(ProcessType type) {
  switch (type) {
    // ... existing cases ...
    case PROCESS_TYPE_WORKSPACE:
      return "Workspace";
    default:
      return "Unknown";
  }
}
```

### 2.2 Workspace Process Host

**New File:** `content/browser/workspace_process/workspace_process_host.h`

```cpp
#ifndef CONTENT_BROWSER_WORKSPACE_PROCESS_WORKSPACE_PROCESS_HOST_H_
#define CONTENT_BROWSER_WORKSPACE_PROCESS_WORKSPACE_PROCESS_HOST_H_

#include "content/browser/browser_child_process_host_impl.h"
#include "base/uuid.h"
#include <vector>

namespace content {

// Manages a workspace process. A workspace process is a lightweight broker
// that supervises the renderer processes for all tabs within a workspace.
class WorkspaceProcessHost : public BrowserChildProcessHostDelegate {
 public:
  WorkspaceProcessHost(int workspace_id, const base::Uuid& workspace_uuid);
  ~WorkspaceProcessHost() override;

  // Launch the workspace process
  bool Start();

  // Process ID of the workspace process
  int GetProcessId() const;

  // UUID of the associated workspace
  const base::Uuid& GetWorkspaceUuid() const { return workspace_uuid_; }

  // Register/unregister child tabs under this workspace
  void RegisterTabProcess(int tab_id, int renderer_pid);
  void UnregisterTabProcess(int tab_id);

  // Notifications from child renderer processes
  void OnTabMemoryPressure(int tab_id, content::MemoryPressureLevel level);

  // BrowserChildProcessHostDelegate implementation
  void OnProcessLaunched() override;
  void OnProcessCrashed(int exit_code) override;
  bool OnMessageReceived(const IPC::Message& message) override;

 private:
  std::unique_ptr<BrowserChildProcessHostImpl> workspace_process_host_;
  base::Uuid workspace_uuid_;
  std::map<int, int> tab_id_to_renderer_pid_;  // for tracking
};

}  // namespace content

#endif
```

**New File:** `content/browser/workspace_process/workspace_process_host.cc`

Implement WorkspaceProcessHost with launcher logic. The workspace process can be implemented as a utility process variant.

### 2.3 Workspace Process Manager (Singleton)

**New File:** `content/browser/workspace_process/workspace_process_manager.h`

```cpp
#ifndef CONTENT_BROWSER_WORKSPACE_PROCESS_WORKSPACE_PROCESS_MANAGER_H_
#define CONTENT_BROWSER_WORKSPACE_PROCESS_WORKSPACE_PROCESS_MANAGER_H_

#include <map>
#include <memory>
#include "base/uuid.h"

namespace content {

class WorkspaceProcessHost;

// Singleton that manages all workspace processes
class WorkspaceProcessManager {
 public:
  static WorkspaceProcessManager* GetInstance();

  // Get or create a workspace process
  WorkspaceProcessHost* GetOrCreateWorkspaceProcess(
      const base::Uuid& workspace_uuid);

  // Terminate a workspace process (and all child renderers)
  void TerminateWorkspaceProcess(const base::Uuid& workspace_uuid);

  // Get existing workspace process
  WorkspaceProcessHost* GetWorkspaceProcess(const base::Uuid& workspace_uuid);

 private:
  WorkspaceProcessManager() = default;
  friend struct DefaultSingletonTraits<WorkspaceProcessManager>;

  std::map<base::Uuid, std::unique_ptr<WorkspaceProcessHost>>
      workspace_processes_;
};

}  // namespace content

#endif
```

Implement the manager with process lifecycle logic.

### 2.4 Modify RenderProcessHostImpl for Workspace Awareness

**File:** `content/browser/renderer_host/render_process_host_impl.h`

Add workspace context:

```cpp
// In RenderProcessHostImpl class
private:
  base::Uuid associated_workspace_uuid_;  // which workspace this renderer serves

public:
  void SetAssociatedWorkspace(const base::Uuid& workspace_uuid) {
    associated_workspace_uuid_ = workspace_uuid;
  }
  const base::Uuid& GetAssociatedWorkspace() const {
    return associated_workspace_uuid_;
  }
```

**File:** `content/browser/renderer_host/render_process_host_impl.cc`

In the renderer process creation logic (e.g., `CreateRendererProcess()`), assign the renderer to the workspace's WorkspaceProcessHost.

### 2.5 Site Instance Modification

**File:** `content/browser/site_instance_impl.h`

Add workspace awareness to site instance creation:

```cpp
// In SiteInstanceImpl
private:
  base::Uuid workspace_uuid_;

public:
  void SetWorkspace(const base::Uuid& uuid) { workspace_uuid_ = uuid; }
  const base::Uuid& GetWorkspace() const { return workspace_uuid_; }
```

This ensures that when a new tab is created within a workspace, it gets a SiteInstance that knows its workspace context, and thus gets assigned to the correct WorkspaceProcess.

### 2.6 Implementation Order and Dependency Notes

**Order:**
1. Define `PROCESS_TYPE_WORKSPACE` in process_type.h
2. Create `WorkspaceProcessHost` (implements the broker logic)
3. Create `WorkspaceProcessManager` (manages the pool of processes)
4. Modify `RenderProcessHostImpl` to accept workspace UUID and register with WorkspaceProcessHost
5. Modify `SiteInstanceImpl` to carry workspace UUID

**Risks:**
- **Process Creation Lag:** Every new tab in a workspace must register with the WorkspaceProcessHost. If WorkspaceProcessHost crashes, all tabs in that workspace are orphaned. Mitigate with watchdog timers and automatic respawn.
- **IPC Complexity:** Tabs must communicate with both their parent WorkspaceProcessHost and the Browser process. Design IPC routing carefully to avoid bottlenecks.
- **Platform Differences:** OS-level process groups (setpgid, Job Objects) have different semantics per platform. The WorkspaceProcessHost abstraction should hide these.

---

## Phase 3: Memory Management (Tiered Memory Caching)

### 3.1 Workspace Memory Manager

**New File:** `chrome/browser/resource_coordinator/workspace_memory_manager.h`

```cpp
#ifndef CHROME_BROWSER_RESOURCE_COORDINATOR_WORKSPACE_MEMORY_MANAGER_H_
#define CHROME_BROWSER_RESOURCE_COORDINATOR_WORKSPACE_MEMORY_MANAGER_H_

#include "base/uuid.h"
#include "base/observer_list.h"
#include "workspaces/workspace_node.h"  // for MemoryTier enum
#include <map>
#include <memory>

namespace resource_coordinator {

class WorkspaceMemoryManagerObserver {
 public:
  virtual ~WorkspaceMemoryManagerObserver() = default;
  virtual void OnWorkspaceMemoryTierChanged(
      const base::Uuid& workspace_or_tab_id,
      workspaces::MemoryTier old_tier,
      workspaces::MemoryTier new_tier) {}
  virtual void OnWorkspaceMemoryBudgetExceeded(
      const base::Uuid& workspace_id,
      uint64_t used_bytes,
      uint64_t budget_bytes) {}
};

// Manages memory for workspaces with tiered caching
class WorkspaceMemoryManager {
 public:
  WorkspaceMemoryManager();
  ~WorkspaceMemoryManager();

  // Set per-workspace memory budget (bytes)
  void SetWorkspaceMemoryBudget(const base::Uuid& workspace_id,
                                  uint64_t budget_bytes);
  uint64_t GetWorkspaceMemoryBudget(const base::Uuid& workspace_id);

  // Get current memory usage
  uint64_t GetWorkspaceMemoryUsage(const base::Uuid& workspace_id);

  // Manually promote/demote a tab to a memory tier
  void SetTabMemoryTier(const base::Uuid& tab_id,
                         const base::Uuid& workspace_id,
                         workspaces::MemoryTier tier);

  // Query current tier
  workspaces::MemoryTier GetTabMemoryTier(const base::Uuid& tab_id);

  // Check if a workspace's activeMemory flag should trigger pre-loading
  bool ShouldPreLoadWorkspace(const base::Uuid& workspace_id);

  // Observer management
  void AddObserver(WorkspaceMemoryManagerObserver* observer);
  void RemoveObserver(WorkspaceMemoryManagerObserver* observer);

 private:
  void EvaluateMemoryPressure();
  void TransitionTierIfNeeded(const base::Uuid& tab_id);

  struct WorkspaceMemoryState {
    uint64_t budget_bytes = 0;
    uint64_t used_bytes = 0;
    bool active_memory = false;
  };

  std::map<base::Uuid, WorkspaceMemoryState> workspace_memory_state_;
  std::map<base::Uuid, workspaces::MemoryTier> tab_memory_tiers_;

  base::ObserverList<WorkspaceMemoryManagerObserver> observers_;
};

}  // namespace resource_coordinator

#endif
```

### 3.2 Integrate with Tab Lifecycle

**File:** `chrome/browser/resource_coordinator/tab_lifecycle_unit.h`

Add workspace awareness:

```cpp
// In TabLifecycleUnitImpl class
private:
  base::Uuid workspace_id_;
  workspaces::MemoryTier memory_tier_ = workspaces::MemoryTier::kCold;

public:
  void SetWorkspace(const base::Uuid& id) { workspace_id_ = id; }
  const base::Uuid& GetWorkspace() const { return workspace_id_; }

  workspaces::MemoryTier GetMemoryTier() const { return memory_tier_; }
  void SetMemoryTier(workspaces::MemoryTier tier);
```

**File:** `chrome/browser/resource_coordinator/tab_manager.h`

Modify the discard decision logic to be workspace-aware:

```cpp
// In TabManager class
private:
  std::unique_ptr<WorkspaceMemoryManager> workspace_memory_manager_;

protected:
  // Override existing discard logic to check workspace constraints
  TabLifecycleUnit* GetTabToDiscard(
      content::WebContents* new_tab,
      const base::Uuid* preferred_workspace_id = nullptr) override;
```

### 3.3 Memory Tier Transitions

Define state machine for tier transitions. Create a utility class:

**New File:** `chrome/browser/resource_coordinator/memory_tier_transition.h`

```cpp
// Utility for transitioning tabs between memory tiers
namespace resource_coordinator {

class MemoryTierTransition {
 public:
  // Freeze a tab's DOM and keep only serialized state (hot -> warm)
  static void FreezeTabDOM(content::WebContents* web_contents);

  // Serialize tab state and discard renderer (warm -> cool)
  static void SerializeTabState(content::WebContents* web_contents);

  // Discard renderer and keep only URL (cool -> cold)
  static void DiscardRenderer(content::WebContents* web_contents);

  // Restore from serialized state (cool -> warm or warm -> hot)
  static void RestoreFromState(content::WebContents* web_contents);

  // Full reload from URL (cold -> hot)
  static void ReloadFromURL(content::WebContents* web_contents);
};

}
```

Implement these by coordinating with TabRestoreService and RenderWidgetHost.

### 3.4 Integration with Performance Manager

**File:** `chrome/browser/performance_manager/performance_manager.h`

Extend performance manager to track workspace-level metrics:

```cpp
// Add workspace-aware metrics collection
void CollectWorkspaceMetrics(const base::Uuid& workspace_id);
```

---

## Phase 4: UI - Sidebar Tree View

### 4.1 Sidebar Panel Entry

**New File:** `chrome/browser/ui/views/side_panel/workspace_side_panel.h`

```cpp
#ifndef CHROME_BROWSER_UI_VIEWS_SIDE_PANEL_WORKSPACE_SIDE_PANEL_H_
#define CHROME_BROWSER_UI_VIEWS_SIDE_PANEL_WORKSPACE_SIDE_PANEL_H_

#include "chrome/browser/ui/views/side_panel/side_panel_entry.h"
#include "ui/views/controls/tree/tree_view.h"
#include "base/memory/weak_ptr.h"

namespace workspaces {
class WorkspaceModel;
class WorkspaceNode;
}

class WorkspaceSidePanel : public views::View {
 public:
  explicit WorkspaceSidePanel(workspaces::WorkspaceModel* workspace_model);
  ~WorkspaceSidePanel() override;

  // Rebuild tree view from workspace model
  void RefreshTree();

  // views::View override
  void Layout() override;

 private:
  void OnWorkspaceAdded(workspaces::WorkspaceNode* workspace);
  void OnWorkspaceRemoved(const base::Uuid& workspace_id);
  void OnTabAdded(workspaces::WorkspaceNode* workspace,
                   workspaces::WorkspaceNode* tab);

  std::unique_ptr<views::TreeView> tree_view_;
  workspaces::WorkspaceModel* workspace_model_;  // weak ref
};

#endif
```

### 4.2 Tree Model Implementation

**New File:** `chrome/browser/ui/views/side_panel/workspace_tree_model.h`

```cpp
// Adapts WorkspaceModel to ui/views::TreeModel interface
class WorkspaceTreeModel : public ui::TreeModel {
 public:
  explicit WorkspaceTreeModel(workspaces::WorkspaceModel* workspace_model);

  // ui::TreeModel implementation
  ui::TreeModelNode* GetRoot() override;
  int GetChildCount(ui::TreeModelNode* parent) override;
  ui::TreeModelNode* GetChild(ui::TreeModelNode* parent, int index) override;
  int IndexOf(ui::TreeModelNode* parent, ui::TreeModelNode* child) override;
  bool IsContainedBy(ui::TreeModelNode* ancestor,
                      ui::TreeModelNode* child) override;
  int GetIconIndex(ui::TreeModelNode* node) override;

 private:
  workspaces::WorkspaceNode* GetWorkspaceNode(ui::TreeModelNode* node);
};
```

### 4.3 Sidebar Entry Registration

**File:** `chrome/browser/ui/views/side_panel/side_panel.cc` or similar registration point

Register the WorkspaceSidePanel:

```cpp
// In side panel initialization code
auto workspace_entry = std::make_unique<SidePanelEntry>(
    SidePanelEntryId::kWorkspace,
    u"Workspaces",
    ui::ImageModel::FromVectorIcon(
        vector_icons::kBookmarkIcon,  // TODO: use workspace icon
        ui::kColorIcon),
    base::BindRepeating(&CreateWorkspaceSidePanel, browser));

side_panel->AddEntry(std::move(workspace_entry));
```

### 4.4 Drag-and-Drop in Tree View

Modify WorkspaceSidePanel to handle drag-drop operations:

```cpp
// In workspace_side_panel.cc
void WorkspaceSidePanel::OnDragDropped(
    ui::OSExchangeData& data,
    ui::TreeModelNode* target_parent,
    int target_index) {
  // Handle moving tabs between workspaces
  // Handle dragging URLs into a workspace to create tabs
  // Handle dragging workspace reordering
}
```

### 4.5 Context Menu

Add right-click context menu to tree nodes:

```cpp
// In workspace_side_panel.cc
void WorkspaceSidePanel::ShowContextMenu(
    ui::TreeModelNode* node,
    const gfx::Point& point) {
  // "Rename workspace"
  // "Set active memory"
  // "Set memory budget"
  // "Delete workspace" (with warning for persisted ones)
  // For tabs: "Close tab", "Move to workspace", "Pin/unpin"
}
```

---

## Phase 5: Session Restore & Persistence

### 5.1 Workspace Storage Schema

**New File:** `chrome/browser/workspaces/workspace_storage.h`

```cpp
// SQLite-based or LevelDB-based storage for workspace metadata
class WorkspaceStorage {
 public:
  // Save workspace tree structure
  bool SaveWorkspaceTree(const workspaces::WorkspaceNode* root);

  // Load workspace tree from disk
  std::unique_ptr<workspaces::WorkspaceNode> LoadWorkspaceTree();

  // Save per-workspace settings (activeMemory flag, memory budget)
  bool SaveWorkspaceSettings(const workspaces::WorkspaceNode* workspace);
};
```

Workspace structure saved to disk includes:
- Workspace UUID, title, creation time
- `persisted` flag (bool)
- `activeMemory` flag (bool)
- Memory budget (bytes)
- Child nodes (trees of bookmarks and tab placeholders)

Tab entries in persisted workspaces store:
- Tab UUID, title, URL, favicon URL
- Last active time
- Memory tier assignment

### 5.2 Session Restore Integration

**File:** `chrome/browser/sessions/session_service.h`

Modify to work with workspaces:

```cpp
// In SessionService class
void BuildRestoredWorkspaces(
    std::vector<std::unique_ptr<workspaces::WorkspaceNode>>* restored_workspaces);

void SaveWorkspaceState(
    const workspaces::WorkspaceNode* workspace);
```

**File:** `chrome/browser/sessions/session_service.cc`

Implement session restore logic:

```cpp
void SessionService::RestoreSession() {
  // 1. Load persisted workspaces from WorkspaceStorage
  auto workspace_tree = workspace_storage_->LoadWorkspaceTree();

  // 2. For each persisted workspace:
  //    - If activeMemory = true: restore to hot/warm tier
  //    - If activeMemory = false: restore to cold tier (URL only)

  // 3. Ephemeral workspaces are NOT restored

  // 4. Register all restored workspaces with WorkspaceModel
  // 5. For hot/warm workspaces, enqueue tab loads
}
```

**Key Behavior:**

| Workspace Type | Persisted | activeMemory | On Restore |
|---|---|---|---|
| Saved Project | yes | yes | Create tabs, load in hot tier |
| Saved Project | yes | no | Create tabs, load in cold tier |
| Session Tab Group | no | yes | Discarded (ephemeral) |
| Session Tab Group | no | no | Discarded (ephemeral) |

### 5.3 WorkspaceNode Serialization

**File:** `chrome/browser/workspaces/workspace_node.cc`

Implement SerializeToJSON and DeserializeFromJSON:

```cpp
// Example JSON structure
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "workspace",
  "title": "Research Project",
  "persisted": true,
  "active_memory": false,
  "creation_time": 1712239200,
  "children": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "type": "tab",
      "title": "GitHub Issue",
      "url": "https://github.com/org/repo/issues/123",
      "favicon_url": "https://github.com/favicon.ico",
      "memory_tier": "cold"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "type": "bookmark",
      "title": "References",
      "children": [...]
    }
  ]
}
```

---

## Phase 6: Integration Points

### 6.1 Task Manager

**File:** `chrome/browser/task_manager/task_manager.cc`

Modify TaskManager to display workspace hierarchy:

```cpp
// In TaskManager::Refresh()
// Group tasks by workspace instead of flat list
// Each workspace shows as a parent node with child tab tasks
```

**File:** `chrome/browser/ui/task_manager/task_manager_view.h`

Update UI to show workspace tree instead of flat table. Add "End Workspace" action that terminates the WorkspaceProcessHost.

### 6.2 Chrome Sync Compatibility

**File:** `components/sync/model_impl/`

For cloud sync compatibility, consider:

**Option A (Simple):** Don't sync workspaces (keep them local-only, like current tab groups).

**Option B (Complex):** Map persisted workspaces to a special bookmark folder:
- Create a hidden `/.sync/Workspaces/` bookmark folder
- Each persisted workspace becomes a sub-folder
- Sync this structure via existing bookmark sync
- Workspace metadata (activeMemory, memory tier) stored in custom properties

Recommend Option A for initial implementation.

### 6.3 Keyboard Shortcuts

**File:** `chrome/app/chrome_command_ids.h`

Add commands:

```cpp
#define IDC_WORKSPACE_MANAGER 23100
#define IDC_NEW_WORKSPACE 23101
#define IDC_NEXT_WORKSPACE 23102
#define IDC_PREV_WORKSPACE 23103
```

**File:** `chrome/browser/ui/browser_commands.h/.cc`

Implement commands to create, switch, and manage workspaces.

### 6.4 Settings UI

**File:** `chrome/browser/ui/webui/settings/`

Add workspace settings page:
- List of workspaces
- Per-workspace memory budget configuration
- activeMemory toggle
- Persistence toggle

### 6.5 Command Line Flags

**File:** `chrome/common/chrome_switches.h`

Add feature flag:

```cpp
extern const base::FeatureState kWorkspaceModel;
```

**File:** `chrome/common/chrome_switches.cc`

```cpp
const base::Feature kWorkspaceModel{"WorkspaceModel",
                                     base::FEATURE_DISABLED_BY_DEFAULT};
```

Use `base::FeatureList::IsEnabled(features::kWorkspaceModel)` to gate new code paths during rollout.

---

## Implementation Checklist

### Phase 1: Data Model
- [ ] WorkspaceNode class (ID, tree structure, metadata)
- [ ] WorkspaceModel class (CRUD operations, observers)
- [ ] JSON serialization/deserialization
- [ ] Integration shim in TabStripModel
- [ ] GN build setup

### Phase 2: Process Architecture
- [ ] PROCESS_TYPE_WORKSPACE definition
- [ ] WorkspaceProcessHost implementation
- [ ] WorkspaceProcessManager singleton
- [ ] RenderProcessHostImpl workspace integration
- [ ] SiteInstanceImpl workspace awareness

### Phase 3: Memory Management
- [ ] WorkspaceMemoryManager class
- [ ] TabLifecycleUnit workspace fields
- [ ] TabManager discard logic (workspace-aware)
- [ ] Memory tier transition utilities
- [ ] Performance metrics collection

### Phase 4: UI
- [ ] Sidebar panel entry registration
- [ ] Tree view model and view
- [ ] Context menu handlers
- [ ] Drag-and-drop support
- [ ] Visual indicators (persisted, activeMemory flags)

### Phase 5: Persistence
- [ ] WorkspaceStorage implementation
- [ ] Session restore integration
- [ ] WorkspaceNode JSON schema finalization
- [ ] Backward compatibility (old bookmark/tab-group imports)

### Phase 6: Integration
- [ ] Task manager hierarchy display
- [ ] Workspace-aware process termination
- [ ] Keyboard shortcuts
- [ ] Settings UI
- [ ] Feature flag gating

---

## Testing Strategy

### Unit Tests
- WorkspaceNode tree operations (add, remove, lookup)
- WorkspaceModel CRUD and observer notifications
- JSON serialization round-trips
- Memory tier state transitions

### Integration Tests
- Workspace process lifecycle (create, crash, respawn)
- Tab creation and assignment to workspaces
- Memory pressure handling (tier demotion/promotion)
- Session restore with various workspace flags

### Browser Tests
- Sidebar interactions (create, rename, delete workspaces)
- Drag-and-drop between workspaces
- Task manager workspace hierarchy
- Settings UI controls

### Performance Tests
- Memory overhead of workspace tracking
- Startup time with many workspaces
- Memory tier transition latency

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| WorkspaceProcess crashes orphan tabs | Watchdog timer + automatic respawn. Tabs detect orphaning via heartbeat and migrate to temp workspace. |
| Memory tier transitions are slow | Cache serialized states. Implement fast path for warm->hot (deserialize from snapshot). |
| Sync compatibility broken | Keep workspaces local-only for v1. Add sync support in v2 with bookmark folder mapping. |
| Performance regression from tree model | Lazy-load tree; cache node lookups; measure critical paths. |
| UI confusion (workspace vs. bookmarks) | Clear visual distinction. Use icons and colors. Provide tooltips. |

---

## Future Enhancements (Post-v1)

1. **Cross-Device Workspace Sync:** Sync workspace state to other devices via account login (not local sync).
2. **Workspace Snapshots:** Save/restore workspace state at specific points (e.g., before closing).
3. **Shared Workspaces:** Collaboration feature; share workspace with team members.
4. **Workspace Templates:** Pre-configured workspaces for common tasks (e.g., "Research", "Development").
5. **AI-Powered Workspace Suggestions:** Auto-group tabs based on content similarity.
6. **Mobile Support:** Mirror workspace tree on mobile via sync.

---

## References

- Chromium Architecture: `docs/design/multi_process_architecture.md`
- Tab Groups Implementation: `chrome/browser/ui/tabs/tab_group_*`
- Bookmarks Architecture: `components/bookmarks/browser/`
- Resource Coordinator: `chrome/browser/resource_coordinator/`
- Side Panel: `chrome/browser/ui/views/side_panel/`
- Session Service: `chrome/browser/sessions/`

---

**Document Version:** 1.0
**Author:** Chromium Architecture Team
**Last Reviewed:** April 2026
