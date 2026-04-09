# Integration Plan: Workspace Keyboard Navigation & Tab Management

## Target Codebase

`workspace-prototype.html` — single-file React 18 + Babel standalone prototype (~1250 lines). Key components: `App` (root state), `WorkspacePanel` (sidebar with omnibar + tree), `WsFolder`/`WsTab` (tree nodes), `ChatInterface`, `PageOverlay`.

## Architecture Approach

This feature requires changes to three layers:

### 1. Tree State Model (App component)
Add cursor position, selection set, move mode, and filter state to App. The tree data already exists (`root` state) — we extend it with navigation metadata.

### 2. Tree Rendering (WorkspacePanel → WsFolder/WsTab)
Add visual states for cursor, selection, drop targets. Add keyboard event handler on the tree container. Add drag-drop handlers on individual rows. Add the "Ungrouped" section at the bottom.

### 3. Navigation Side Effects (App)
When a URL navigation occurs (omnibar Enter or chat link), create a new tab node in an ungrouped array and set it as the cursor item.

### Data Flow
```
App
├── cursorId: string               (which item has the cursor)
├── selectedIds: Set<string>       (which items are selected)
├── moveMode: boolean              (cut/paste active)
├── moveSourceIds: string[]        (items being moved)
├── filterText: string             (type-to-navigate)
├── ungroupedTabs: TabNode[]       (tabs not in any folder)
│
├─> WorkspacePanel
│     ├── onKeyDown handler        (all keyboard logic)
│     ├── flattenedVisibleItems    (computed from root + ungrouped, respecting collapse)
│     ├── WsFolder (enhanced)      (cursor/selection/drop-target visual states)
│     ├── WsTab (enhanced)         (cursor/selection/draggable states)
│     ├── UngroupedSection         (new component)
│     ├── FilterOverlay            (type-to-navigate input)
│     └── ShortcutOverlay          (? key help)
│
├─> ChatInterface
│     └── onOpenTab now also adds to ungroupedTabs
│
└─> PageOverlay (unchanged)
```

## File Map

| Action | Location (line ranges approximate) | Description |
|--------|-------------------------------------|-------------|
| Modify | `App` state (~line 1050) | Add cursorId, selectedIds, moveMode, moveSourceIds, filterText, ungroupedTabs |
| Modify | `App` openTab handler (~line 1075) | Also push new tab to ungroupedTabs array |
| Modify | `WorkspacePanel` (~line 250-310) | Add onKeyDown, flattenVisibleItems memo, cursor/selection props to tree nodes |
| Modify | `WsFolder` (~line 160) | Add cursor highlight, selection checkmark, drop target, drag-drop handlers, index badge |
| Modify | `WsTab` (~line 195) | Add cursor highlight, selection checkmark, draggable, drag handlers |
| Create | `UngroupedSection` component | New: renders ungroupedTabs with divider label |
| Create | `FilterOverlay` component | New: type-to-navigate input that filters the tree |
| Create | `ShortcutOverlay` component | New: keyboard shortcut reference panel |
| Create | `useTreeKeyboard` hook (inline) | New: keyboard event handler with all shortcut logic |
| Modify | `App` JSX (~line 1110) | Pass new state + handlers to WorkspacePanel |

## Implementation Sequence

1. **Add state variables to App** (no dependencies)
   - `cursorId`, `selectedIds`, `moveMode`, `moveSourceIds`, `filterText`, `ungroupedTabs`
   - Handlers: `setCursorId`, `toggleSelect`, `selectAll`, `clearSelection`, `enterMoveMode`, `executeDrop`, `cancelMove`

2. **Build flattenVisibleItems utility** (depends on: step 1)
   - Takes `root` + `ungroupedTabs`, walks the tree respecting `expanded` state
   - Returns flat array of `{id, type, depth, parentId, node}` for keyboard navigation
   - This is the core data structure that makes arrow key nav trivial

3. **Enhance WsFolder and WsTab rendering** (depends on: step 1)
   - Accept `isCursor`, `isSelected`, `isMoveSource`, `isDropTarget` props
   - Add visual states: cursor highlight, selection checkmark, move mode dashed border, drop target indicator
   - Add `draggable`, `onDragStart`, `onDragOver`, `onDrop` handlers
   - Add index badge for root-level folders

4. **Create UngroupedSection component** (depends on: step 1)
   - Renders the ungrouped divider + tab list
   - Same interaction model as tabs in folders (cursor, select, drag)

5. **Build keyboard handler in WorkspacePanel** (depends on: steps 2, 3, 4)
   - `onKeyDown` on the tree container div
   - Arrow key navigation using flattenedVisibleItems
   - Space for selection toggle, Shift+Arrow for range select
   - Ctrl+X / Ctrl+V for move mode
   - Enter for open/toggle
   - Home/End, type-to-navigate trigger, ? for shortcuts
   - Alt+1-9 for position-indexed folder jump

6. **Create FilterOverlay component** (depends on: step 5)
   - Positioned at top of tree when filterText is non-empty
   - Input field with the current filter text
   - Tree filtering logic in flattenVisibleItems

7. **Create ShortcutOverlay component** (depends on: step 5)
   - Triggered by ? key
   - Lists all shortcuts in grouped sections
   - Dismisses on any key or Escape

8. **Update App's openTab to add ungrouped tabs** (depends on: step 4)
   - When a URL is navigated, create tab node and push to ungroupedTabs
   - Set cursorId to the new tab

9. **Wire ARIA attributes** (depends on: steps 3-5)
   - `role="tree"` on container
   - `role="treeitem"` on each node
   - `aria-expanded` on folders
   - `aria-selected` on selected items
   - `aria-activedescendant` pointing to cursorId
   - `tabIndex={0}` on tree container

## Dependencies

No new external dependencies. All features use existing React 18 APIs:
- `useState` / `useCallback` / `useMemo` / `useRef` / `useEffect` for state and keyboard handling
- Native HTML drag-drop API (`draggable`, `onDragStart`, `onDragOver`, `onDrop`)
- Native keyboard events (`onKeyDown`)

## Performance Considerations

- **flattenVisibleItems** is recomputed on every tree change (expand/collapse/move). For the current data size (~20 items) this is negligible. For trees with 100+ items, memoize with `useMemo` keyed on root + expanded states.
- **Keyboard repeat rate:** Arrow key held down fires ~30 events/sec. Each event updates cursorId which triggers a re-render. For 20 items this is fine. For larger trees, consider virtualized rendering (react-window) — but that's a v2 concern.
- **Drag-drop:** Native HTML5 drag-drop has no performance concerns at this scale.

## Testing Strategy

**Keyboard navigation:**
- Arrow Up/Down traverses all visible items in order
- Arrow Right expands collapsed folder, Left collapses expanded folder
- Home/End reach first/last visible item
- Collapsed folders' children are skipped during navigation

**Selection:**
- Space toggles selection independent of cursor
- Shift+Arrow creates contiguous range selection
- Ctrl+A selects all, Escape clears all
- Selection persists across cursor movement

**Move mode:**
- Ctrl+X with selection → items enter move state visually
- Navigate to folder → folder shows drop indicator
- Ctrl+V → items appear in target folder, removed from source
- Escape cancels without moving

**Drag-drop:**
- Drag tab → folder highlights → drop → tab moves to folder
- Drag ungrouped tab → folder → tab removed from ungrouped

**Type-to-navigate:**
- Typing filters tree to matches
- Arrow keys move among matches
- Enter opens match, Escape clears filter

**Accessibility:**
- Tab key enters/exits the tree
- All ARIA attributes present and correct
- Screen reader announces cursor position changes

## Estimated Effort

**M (Medium)** — The keyboard handler is the most complex piece (~80 lines of switch/case logic). The tree flattening utility is straightforward. Visual state changes are additive to existing components. Drag-drop uses native HTML5 API. Most of the effort is in the keyboard handler and ensuring all edge cases (collapsed folders, empty selections, move mode cancellation) work correctly. Estimate 3-4 hours of focused implementation.
