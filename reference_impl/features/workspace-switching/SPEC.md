# Feature Spec: Workspace Hot-Swapping

## Problem Statement

The current prototype has a single workspace tree (root) that contains all tab groups. Users working across multiple contexts (work, research, personal) have no way to cleanly separate and rapidly switch between entire workspace configurations. They must manually manage everything in one tree, leading to clutter, cognitive overload, and lost context when shifting between tasks.

This feature introduces **multiple independent worktrees** that can be hot-swapped with keyboard shortcuts and a persistent visual indicator — like Windows virtual desktops, but for browser workspace trees.

## User Flow

### Switching Workspaces
1. User presses **Ctrl+[1-9]** to jump directly to workspace N (e.g., Ctrl+2 switches to workspace 2)
2. The worktree in the sidebar instantly swaps to the target workspace's tree
3. The canvas (open tabs/panes) updates to show that workspace's active tabs
4. The workspace indicator in the activity bar updates to show the new active workspace
5. Previous workspace state (tree expansion, active tabs, cursor position, scroll) is fully preserved

### Sequential Switching
1. User presses **Ctrl+Alt+Left/Right** to move to the adjacent workspace
2. Same instant swap behavior as direct jump
3. Wraps around: pressing Right on the last workspace goes to the first

### Creating a New Workspace
1. User presses **Ctrl+Alt+N** (or clicks the "+" button in the workspace indicator)
2. A new empty workspace is created and immediately switched to
3. The workspace gets a default name ("Workspace N") and a default icon
4. The sidebar shows an empty tree; the user can start adding tabs

### Renaming a Workspace
1. User double-clicks the workspace name in the indicator, or presses **F2** while the workspace indicator is focused
2. An inline text input appears with the current name selected
3. User types new name, presses Enter to commit or Escape to cancel

### Deleting a Workspace
1. User right-clicks (or long-presses) the workspace indicator pill and selects "Delete"
2. If the workspace has tabs, a confirmation toast appears: "Delete workspace with N tabs?"
3. Confirmed: workspace is removed, user switches to the adjacent workspace
4. Last workspace cannot be deleted

### Reordering Workspaces
1. User drags a workspace pill in the indicator strip to reorder
2. Numbered shortcuts (Ctrl+1-9) always correspond to visual position

## States & Transitions

| State | Description | Trigger | Visual |
|-------|-------------|---------|--------|
| idle | Workspace indicator visible, current workspace highlighted | Default | Active pill is bright, others dimmed |
| switching | Transitioning between workspaces | Ctrl+N, Ctrl+Alt+Arrow | Brief fade transition on sidebar tree |
| creating | New workspace being added | Ctrl+Alt+N or (+) click | New pill appears, becomes active |
| renaming | Inline edit of workspace name | Double-click pill or F2 | Input replaces pill text |
| confirming-delete | Delete confirmation shown | Right-click > Delete on non-empty workspace | Toast with confirm/cancel |

## Inputs & Outputs

### Data Model: `workspaces` Array
```
workspaces = [
  {
    id: "ws-1",
    name: "Daily Driver",
    icon: "layers",        // icon key from ic object
    color: "#60a5fa",      // accent color for pill
    root: { ... },         // full workspace tree (same shape as current INITIAL)
    activeTabs: [],        // open tab panes for this workspace
    mcpPanes: [],          // open MCP app panes
    focusedTabId: null,
    cursorId: null,        // preserved keyboard cursor
    selectedIds: Set,      // preserved selection
    scrollTop: 0,          // preserved tree scroll position
  },
  ...
]
activeWorkspaceId: "ws-1"  // which workspace is currently displayed
```

### State Preservation Per-Workspace
When switching away from a workspace, the following is snapshotted:
- `root` tree (expansion state, tab state, everything)
- `activeTabs` and `mcpPanes` (which panes are open in canvas)
- `focusedTabId` (which tab pane has focus)
- `cursorId`, `selectedIds` (keyboard nav state)
- Sidebar scroll position

When switching to a workspace, all of the above is restored.

## Interaction Details

### Workspace Indicator (Activity Bar Area)
- Rendered as a **horizontal strip of pills** at the top of the sidebar, above the tree
- Each pill shows: workspace number (1-9), icon, abbreviated name
- Active workspace pill has bright accent color + border
- Inactive pills are dimmed, brighten on hover
- (+) button at the end for creating new workspace
- Pills are draggable for reordering

### Icon for This Capability
- Use a **grid/stack icon** representing multiple layered desktops — SVG path inspired by the "copy" or "layers" concept but distinct:
  - Two overlapping rectangles (like Windows Task View icon)
  - Or a 2x2 grid of small squares (like macOS Launchpad)
- This icon appears in the activity bar if the workspace indicator is collapsed

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl+[1-9] | Jump to workspace N |
| Ctrl+Alt+Left | Previous workspace |
| Ctrl+Alt+Right | Next workspace |
| Ctrl+Alt+N | New workspace |
| F2 (on indicator) | Rename workspace |

### Accessibility
- Workspace indicator strip has `role="tablist"`, each pill has `role="tab"`
- `aria-selected` marks active workspace
- Arrow keys navigate between pills when indicator is focused
- Screen reader announces workspace name and position ("Workspace 2 of 5: Research")

## Non-Goals (v1)

- **Cross-workspace tab pinning**: Tabs visible across all workspaces (defer to v2)
- **Workspace templates**: Pre-configured workspace layouts (defer)
- **Workspace sharing/export**: Serializing workspaces for backup or sharing
- **Per-workspace model/provider settings**: All workspaces share the same LLM config
- **Drag tabs between workspaces**: Moving tabs requires cut/paste within the active tree
- **Workspace-specific themes**: Color accent on pill only, not full UI theming
- **More than 9 workspaces**: Keyboard shortcuts limit to Ctrl+1-9; UI scrolling deferred

## Open Questions

1. Should the workspace indicator live in the sidebar (above the tree) or in the activity bar (vertical strip)? Sidebar placement is more visible; activity bar keeps sidebar clean.
2. Should switching animate (slide transition) or be instant? Research suggests instant is better for productivity; animation helps orientation.
3. Should empty workspaces auto-delete after switching away, or persist until explicitly deleted?
