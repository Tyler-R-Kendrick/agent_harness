# Integration Plan: Workspace Hot-Swapping

## Target Codebase

`workspace-prototype.html` — single-file React 18 + Babel standalone prototype (~2200 lines). Inline styles, `useState`/`useCallback` state management at App level, nested tree data model with `deepUpdate` helper.

## Architecture Approach

The core change is lifting the single `root` state into a **workspaces array** where each workspace holds its own `root`, `activeTabs`, `mcpPanes`, `focusedTabId`, and keyboard nav state. A new `activeWorkspaceId` state controls which workspace is displayed.

### Data Flow

```
workspaces[] ─────────────┐
activeWorkspaceId ────────┤
                          ▼
               activeWs = workspaces.find(id)
                          │
                   ┌──────┴──────┐
                   ▼             ▼
            Sidebar Tree    Canvas Panes
            (activeWs.root)  (activeWs.activeTabs + activeWs.mcpPanes)
```

### New Components
- `WorkspacePill` — individual workspace pill in the indicator strip
- `WorkspaceIndicator` — horizontal strip of pills with create/reorder/rename

### Modified Components
- `App` — lift `root`, `activeTabs`, `mcpPanes`, `focusedTabId`, `cursorId`, `selectedIds` into per-workspace objects
- `WorkspacePanel` — receives `activeWs.root` instead of top-level `root`; workspace indicator strip added above tree
- All tree operations (`toggle`, `pin`, `toggleMem`, etc.) scoped via `updateActiveWs` helper

## File Map

| Action | Location in file | Description |
|--------|-----------------|-------------|
| Add | Icons (`ic` object) | Add `desktops` icon path: two overlapping rectangles |
| Add | After constants | `WORKSPACE_COLORS` array, `makeWorkspace()` factory, `INITIAL_WORKSPACES` replacing single `INITIAL` |
| Add | New components section | `WorkspacePill`, `WorkspaceIndicator` components |
| Modify | `App` state declarations | Replace `root`/`activeTabs`/`mcpPanes`/`focusedTabId`/`cursorId`/`selectedIds` with `workspaces[]` + `activeWorkspaceId` |
| Add | `App` body | `activeWs` derived value, `updateActiveWs` helper, workspace CRUD operations |
| Modify | `App` keyboard handler | Add `Ctrl+[1-9]`, `Ctrl+Alt+Left/Right`, `Ctrl+Alt+N`; refactor `Alt+1-9` (currently used for folder jump — reassign or remove) |
| Modify | `WorkspacePanel` render | Add `WorkspaceIndicator` above tree; color bar below indicator |
| Modify | All `setRoot` calls | Replace with `updateActiveWs(ws => ({...ws, root: ...}))` |
| Modify | All `setActiveTabs` calls | Replace with `updateActiveWs(ws => ({...ws, activeTabs: ...}))` |
| Modify | All `setMcpPanes` calls | Replace with `updateActiveWs(ws => ({...ws, mcpPanes: ...}))` |
| Modify | `handleOmniKeyDown` | New tabs added to `activeWs.root` via `updateActiveWs` |
| Modify | `ShortcutOverlay` | Add workspace switching shortcuts section |
| Modify | `ActivityBar` | Add desktops icon as workspace indicator toggle |

## Implementation Sequence

1. **Add icon and constants** (no dependencies)
   - Add `desktops` icon path to `ic` object
   - Add `WORKSPACE_COLORS`, `makeWorkspace()` factory
   - Convert `INITIAL` into `INITIAL_WORKSPACES` array

2. **Refactor App state** (depends on Step 1)
   - Replace `root` state with `workspaces` + `activeWorkspaceId`
   - Derive `activeWs` from state
   - Create `updateActiveWs(fn)` helper that maps over workspaces array

3. **Scope all tree/tab mutations** (depends on Step 2)
   - Find all `setRoot(...)` calls → replace with `updateActiveWs(ws => ({...ws, root: ...}))`
   - Find all `setActiveTabs(...)` calls → replace with `updateActiveWs(ws => ({...ws, activeTabs: ...}))`
   - Find all `setMcpPanes(...)` calls → replace with scoped equivalent
   - Find all `setFocusedTabId(...)` calls → scope to workspace
   - Find all `setCursorId(...)` / `setSelectedIds(...)` calls → scope to workspace

4. **Build workspace indicator UI** (depends on Step 2)
   - Create `WorkspacePill` component
   - Create `WorkspaceIndicator` strip component
   - Add to `WorkspacePanel` above tree
   - Add color accent bar below indicator

5. **Add workspace CRUD operations** (depends on Steps 2-3)
   - `switchTo(id)` — change `activeWorkspaceId`
   - `createWorkspace()` — append new workspace, switch to it
   - `deleteWorkspace(id)` — remove and switch to adjacent
   - `renameWorkspace(id, name)` — update name
   - `reorderWorkspaces(sourceId, targetId)` — drag reorder

6. **Add keyboard shortcuts** (depends on Steps 4-5)
   - `Ctrl+[1-9]` → `switchByIndex(n-1)`
   - `Ctrl+Alt+Left/Right` → `switchPrev/switchNext`
   - `Ctrl+Alt+N` → `createWorkspace`
   - Update `ShortcutOverlay` groups
   - **Conflict**: Current `Alt+1-9` jumps to top-level folders. Reassign to `Alt+Shift+1-9` or keep as-is (different modifier key — no conflict with `Ctrl+1-9`)

7. **Verify and polish** (depends on all above)
   - Test switching preserves tree state (expansion, scroll, cursor)
   - Test omnibar navigation adds tabs to active workspace
   - Test MCP app panes scoped to workspace
   - Test keyboard shortcuts don't conflict with browser defaults
   - Add switch animation (brief fade/slide on tree swap)

## Dependencies

No new libraries needed. All built with existing React 18 + inline styles.

## Performance Considerations

- **State size**: Each workspace holds a full tree + active tabs. With 9 workspaces of ~50 tabs each, this is ~450 nodes — trivial for React state.
- **Re-renders**: `updateActiveWs` replaces the entire workspaces array, triggering re-render of workspace-dependent components. Use `useMemo` to derive `activeWs` and avoid rendering inactive workspace trees.
- **Memory**: Workspace state is lightweight (JSON nodes, not DOM). Actual memory concern is iframe-based `PageOverlay` instances for active tabs — these only exist for the active workspace's tabs.

## Testing Strategy

- **Unit**: Extract `classifyOmni`, `makeWorkspace`, `deepUpdate` into testable functions; test workspace CRUD operations (create, delete, rename, reorder) with state assertions
- **Interaction**: Verify keyboard shortcuts fire correct operations; test Ctrl+1-9 switches, Ctrl+Alt+Arrow wraps around, Ctrl+Alt+N creates and switches
- **State preservation**: Switch away and back — verify tree expansion, cursor position, active tabs all restored
- **Edge cases**: Delete active workspace, delete last remaining (should be blocked), create 10th workspace (Ctrl+9 should be last reachable), reorder while active

## Estimated Effort

**Medium (M)** — The data model refactor (lifting state into workspaces array) is the main work. The UI components (pills, indicator) are straightforward. The keyboard shortcuts are a small addition. Most time goes into finding and scoping all ~15 `setRoot`/`setActiveTabs`/`setMcpPanes` call sites.
