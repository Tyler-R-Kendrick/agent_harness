# Feature Spec: Multi-Pane / Blade Navigation

## Problem Statement

The browser currently shows one page overlay at a time. Users who need to compare pages, reference documentation while working, or monitor multiple sites simultaneously must constantly switch between tabs. This breaks flow and loses context. Multi-pane navigation lets users split the canvas into multiple simultaneous views — from a simple side-by-side comparison up to a 4-pane monitoring dashboard — with an auto-masonry layout that eliminates dead whitespace and respects per-pane importance weighting.

## User Flow

### Flow A: Split from Context Menu (Primary)

1. User right-clicks a tab in the workspace tree.
2. Context menu includes: **"Open in new pane"**, **"Split right"**, **"Split below"**.
3. User clicks "Split right."
4. The canvas area splits into two equal panes. The existing page stays in the left pane. The new tab opens in the right pane.
5. Both panes show their page content (iframes). The new pane has a blue top-border indicating it's the active pane.

### Flow B: Split via Keyboard

1. User presses **Ctrl+\\** (split active pane).
2. A quick-pick dropdown appears listing workspace tabs that aren't already in a pane.
3. User selects a tab (arrow keys + Enter, or type-to-filter).
4. The active pane splits, and the selected tab opens in the new half.
5. Alternatively, **Ctrl+Shift+\\** splits without a picker — opens an empty pane with the omnibar focused for URL entry.

### Flow C: Layout Presets

1. User presses **Ctrl+Alt+L** or clicks a layout icon in the pane header area.
2. A layout preset picker appears with visual thumbnails:
   - **Single** (1 pane — exits multi-pane)
   - **Side by side** (2 panes, vertical split)
   - **Top/bottom** (2 panes, horizontal split)
   - **Three columns** (3 panes, equal)
   - **1+2** (1 large left pane + 2 stacked right panes)
   - **2x2 Grid** (4 equal panes)
3. Selecting a preset rearranges existing panes to fit the layout. If there are fewer tabs than slots, empty slots show "Drop a tab here" placeholders.

### Flow D: Importance Weighting

1. User right-clicks a pane's header bar.
2. Context menu includes: **"Set importance: Low / Normal / High"**.
3. Changing importance recalculates the masonry layout. "High" panes get ~50% more area. "Low" panes get ~50% less. "Normal" is the default equal share.
4. The layout algorithm ensures no whitespace: it distributes area proportionally based on weight while filling the full canvas rectangle.

### Flow E: Pane Management via Keyboard

1. **Alt+Tab** (within the app, not OS): cycles focus between panes. Active pane gets the blue top-border.
2. **Ctrl+1/2/3/4**: focuses pane by position (left-to-right, top-to-bottom).
3. **Ctrl+Shift+Arrow**: moves the active tab to an adjacent pane.
4. **Ctrl+W** on a pane: closes it. Remaining panes re-fill the canvas. If only 1 pane left, returns to single-page mode.

### Flow F: Drag-Drop Pane Creation

1. User drags a tab from the workspace tree toward the canvas.
2. Drop zones appear: left half, right half, top half, bottom half, center (replace active pane).
3. Dropping creates a split in that direction.
4. User can also drag a tab from one pane to another to swap content.

## States & Transitions

| State | Description | Trigger | Visual |
|-------|-------------|---------|--------|
| Single pane | Normal mode, one page overlay | Default / close all splits | Full-canvas single iframe |
| Multi-pane | 2+ panes visible | Split command, context menu, drag | Canvas divided with 1px dividers |
| Pane: active | Focused pane receiving keyboard input | Click pane, Alt+Tab, Ctrl+N | Blue 2px top border, subtle bg tint |
| Pane: inactive | Visible but not focused | Another pane activated | No border highlight, slightly dimmed |
| Pane: empty | Slot waiting for content | Preset created more slots than tabs | "Drop a tab here" placeholder |
| Pane: loading | Tab loading in pane | Tab assigned to pane | Shimmer loading state |
| Layout picker | Preset selection visible | Ctrl+Alt+L | Floating card with layout thumbnails |
| Drop zones | Drag target indicators | Tab dragged over canvas | Semi-transparent directional overlays |

## Inputs & Outputs

**Inputs:**
- Split commands (context menu, keyboard, drag-drop)
- Layout preset selection
- Importance weight changes
- Pane focus changes (click, keyboard)

**Outputs:**
- Pane layout state: array of `{tabId, position, weight}` objects
- Active pane ID
- Layout configuration persisted per workspace session

## Interaction Details

### Pane Header Bar
Each pane gets a thin header (24px) showing:
- Tab name (truncated)
- The page's favicon/initial
- Close pane button (×)
- Right-click for context menu (importance, close, swap)

The active pane's header has a blue top border (2px #60a5fa). Inactive panes have a 1px divider only.

### Masonry Layout Algorithm
The layout fills the full canvas rectangle with zero whitespace:
- All weights are normalized to ratios (e.g., [1, 2, 1] → [25%, 50%, 25%]).
- For 2 panes: simple flex split (equal or weighted).
- For 3 panes: largest pane gets one column, remaining two stack in the other column (1+2 layout).
- For 4 panes: 2x2 grid with weights affecting cell sizes.
- The algorithm is a simplified version of masonry: pack panes into a grid that fills 100% width and 100% height, minimizing aspect ratio distortion.

### Dividers
- 1px solid dividers between panes (rgba(255,255,255,.08)).
- Hovering a divider shows a 4px drag handle. Drag to resize adjacent panes.
- Double-click a divider to reset to equal sizes.

### Keyboard Shortcuts (Complete)

| Key | Action |
|-----|--------|
| Ctrl+\\ | Split active pane (opens tab picker) |
| Ctrl+Shift+\\ | Split active pane (empty, URL entry) |
| Alt+Tab | Cycle focus between panes |
| Ctrl+1-4 | Focus pane by position |
| Ctrl+Shift+Arrow | Move tab to adjacent pane direction |
| Ctrl+W | Close active pane |
| Ctrl+Alt+L | Open layout preset picker |
| Escape | Exit layout picker / cancel drag |

### Context Menu Items (on workspace tree tab)
- "Open in new pane" — opens tab in a new split (auto-chooses direction)
- "Split right" — splits active pane, opens tab in right half
- "Split below" — splits active pane, opens tab in bottom half
- "Replace active pane" — swaps the active pane's content to this tab

### Context Menu Items (on pane header)
- "Set importance: Low / Normal / High"
- "Close pane"
- "Swap with..." (submenu listing other panes)
- "Open in single view" (closes all other panes, keeps this one)

## Non-Goals (v1)

- Arbitrary freeform pane arrangement (snap-to-grid only)
- More than 4 simultaneous panes
- Cross-pane communication or linked scrolling
- Picture-in-picture / floating pane mode
- Saving named layout configurations
- Per-pane zoom level control

## Open Questions

1. Should multi-pane state persist across sessions, or reset when the workspace reopens?
2. When a pane is closed, should its tab stay in the workspace tree or be removed entirely?
3. Should importance weighting be per-pane or per-tab (so the weight follows the tab if moved)?
