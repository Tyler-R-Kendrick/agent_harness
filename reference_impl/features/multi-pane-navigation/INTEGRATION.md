# Integration Plan: Multi-Pane / Blade Navigation

## Target Codebase

`workspace-prototype.html` — single-file React 18 + Babel standalone prototype (~1250 lines). The `PageOverlay` component currently renders a single iframe overlay on top of the chat interface. This feature replaces the single-overlay model with a multi-pane layout manager.

## Architecture Approach

### Core Change: Replace single `overlayTab` with `panes` array

Currently, `App` holds `overlayTab` (a single tab object or null). This changes to:

```
overlayTab: TabNode | null  →  panes: Array<{id, tabId, weight}>
                                activeLayout: "single"|"side-by-side"|"top-bottom"|"1+2"|"2x2"
                                activePaneId: string
```

When `panes.length === 0`, the chat interface is shown (same as current `overlayTab === null`). When `panes.length >= 1`, the `MultiPaneOverlay` component renders instead of `PageOverlay`.

### New Components

```
App (state: panes, activeLayout, activePaneId)
  ├─> WorkspacePanel
  │     └─ WsTab: adds context menu with "Open in new pane", "Split right", "Split below"
  │
  └─> MultiPaneOverlay (new, replaces PageOverlay for multi-pane cases)
        ├─> PaneLayoutManager (computes flex layout from panes + activeLayout + weights)
        ├─> Pane (one per entry in panes array)
        │     ├─> PaneHeader (tab name, importance, close)
        │     ├─> iframe (the actual page content)
        │     └─> ElementPickerOverlay (existing, per-pane)
        ├─> LayoutPicker (floating preset selector)
        └─> PaneContextMenu (importance, close, swap)
```

### Data Flow

```
User action (context menu / keyboard)
  → App updates panes array + activeLayout
    → MultiPaneOverlay receives panes + layout
      → PaneLayoutManager computes flex styles for each pane
        → Each Pane renders with computed flex + weight
```

## File Map

| Action | Location | Description |
|--------|----------|-------------|
| Create | `MultiPaneOverlay` component | New: replaces PageOverlay when panes.length >= 1. Contains layout logic, pane rendering, keyboard handler |
| Create | `Pane` component | New: single pane with header, iframe, picker overlay. Receives flex style from layout manager |
| Create | `PaneHeader` component | New: 24px bar with tab name, importance dot, close button |
| Create | `LayoutPicker` component | New: floating card with 5 layout preset thumbnails |
| Create | `PaneContextMenu` component | New: right-click menu on pane headers (importance, close, swap) |
| Modify | `App` state (~line 1050) | Replace `overlayTab` with `panes`, `activeLayout`, `activePaneId`. Add pane management handlers |
| Modify | `WsTab` component (~line 195) | Add onContextMenu with "Open in new pane", "Split right", "Split below" options |
| Modify | `App` JSX (~line 1130) | Render `MultiPaneOverlay` when `panes.length > 0` instead of `PageOverlay` |
| Keep | `PageOverlay` | Keep as-is for backward compatibility. Used when exactly 1 pane in "single" layout (or remove and always use MultiPaneOverlay) |
| Modify | `ic` object (~line 43) | Add icons: columns, rows, grid, maximize, minimize |

## Implementation Sequence

1. **Add pane state to App** (no dependencies)
   - `panes: [{id, tabId, weight:"normal"}]`
   - `activeLayout: "single"`
   - `activePaneId: string`
   - Handlers: `addPane`, `removePane`, `setActivePane`, `setPaneWeight`, `setLayout`

2. **Build PaneHeader component** (depends on: step 1)
   - 24px bar with tab name, colored dot, close button
   - Active state: 2px blue top border
   - Right-click opens PaneContextMenu

3. **Build Pane component** (depends on: step 2)
   - Wraps PaneHeader + iframe + ElementPickerOverlay
   - Receives `style` prop (flex values computed by parent)
   - Click handler sets this pane as active

4. **Build PaneLayoutManager / MultiPaneOverlay** (depends on: step 3)
   - Computes flex styles based on `activeLayout` and `panes` array:
     - **single**: `[{flex:1}]`
     - **side-by-side**: `[{flex:w1}, {flex:w2}]` in a row
     - **top-bottom**: `[{flex:w1}, {flex:w2}]` in a column
     - **1+2**: outer row, left `{flex:1.5*w1}`, right column `{flex:1}` containing 2 stacked panes
     - **2x2**: flex-wrap row, each `{flexBasis:"50%", flex:wN}`
   - Renders Pane components with computed styles
   - Handles keyboard events (Ctrl+1-4, Ctrl+W, Alt+Tab)

5. **Build LayoutPicker** (depends on: step 4)
   - Floating card positioned near top-right of canvas
   - 5 thumbnail buttons showing layout patterns
   - Triggered by Ctrl+Alt+L or a small button in the canvas area

6. **Build PaneContextMenu** (depends on: step 2)
   - Appears on right-click of PaneHeader
   - Options: Set importance (Low/Normal/High), Close pane, Swap with..., Open in single view

7. **Add context menu to WsTab** (depends on: step 1)
   - Right-click on workspace tree tabs shows "Open in new pane", "Split right", "Split below", "Replace active pane"
   - Each option calls the appropriate App handler

8. **Replace PageOverlay rendering in App** (depends on: steps 4, 7)
   - When `panes.length > 0`: render `MultiPaneOverlay`
   - When `panes.length === 0`: render chat interface (current behavior)
   - Migrate existing overlay state (chatOpen, pickerActive, etc.) to be per-pane

9. **Wire keyboard shortcuts globally** (depends on: step 4)
   - Ctrl+\\ : split active pane
   - Alt+Tab : cycle active pane
   - Ctrl+1-4 : focus pane by position
   - Ctrl+W : close active pane
   - Ctrl+Alt+L : toggle layout picker

## Dependencies

No new external dependencies. The layout uses CSS flexbox exclusively (already supported). All new components follow the existing inline-style React pattern.

## Performance Considerations

- **Multiple iframes:** Each pane loads an iframe. With 4 panes, that's 4 render processes. For the prototype (simulated content) this is a non-issue. In production, consider using the Tab Discard API to manage memory for panes showing less-important content.
- **Layout recalculation:** Flex layout is handled by the browser's layout engine. Changing weights triggers a reflow, but flex recalc for 4 items is sub-millisecond.
- **Transitions:** Use CSS `transition: flex .2s ease` on panes for smooth weight changes. Avoid layout animation on initial render (use `animation: none` for first frame).
- **Divider drag resize (future):** Would require a mouseMove handler throttled to 60fps. Not in v1.

## Testing Strategy

**Layout correctness:**
- Single pane fills 100% canvas
- Side-by-side: two panes each ~50% width, 100% height
- Top-bottom: two panes each ~50% height, 100% width
- 1+2: left pane ~60%, right column ~40% with two stacked panes
- 2x2: four equal quadrants

**Importance weighting:**
- Setting one pane to "High" visually increases its area
- Setting to "Low" decreases it
- All weights normalize so total fill stays at 100%

**Keyboard:**
- Ctrl+1-4 focuses correct pane by position
- Alt+Tab cycles through panes in order
- Ctrl+W closes active pane and remaining panes re-fill
- Closing last pane returns to chat interface

**Context menu:**
- "Split right" on a tree tab creates a new pane to the right
- "Open in new pane" creates a pane and switches to side-by-side layout
- Importance changes update layout with transition

## Estimated Effort

**M (Medium)** — The main complexity is the layout manager (computing flex styles for 5 layout modes with variable weights). The individual components (Pane, PaneHeader, LayoutPicker) are straightforward. Keyboard handling follows the same pattern already established for workspace tree navigation. Estimate 4-5 hours: 2 hours for layout engine + components, 1 hour for context menus, 1 hour for keyboard shortcuts, 1 hour for testing all layout combinations.
