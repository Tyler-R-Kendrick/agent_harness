# Research: Multi-Pane / Blade Navigation

## Prior Art

### Azure Portal (Blade Navigation)
- **How it works:** Sequential left-to-right cascade. Each action opens a new "blade" (pane) to the right. Horizontal scroll keeps context visible. Clicking a blade focuses it. Closing a blade closes all blades to its right.
- **Key UX decisions:** Blades represent a navigation stack — each is a deeper level of detail. The rightmost blade is the active one. Width is fixed per blade type but varies between blade types. Auto-scrolls to show the newest blade.
- **Limitations:** Only works for hierarchical drill-down workflows. Horizontal scrolling becomes tedious with 5+ blades. Not suited for comparing unrelated pages side-by-side.

### Vivaldi Browser (Tab Tiling)
- **How it works:** Select multiple tabs (Ctrl+Click or Shift+Click), then right-click → "Tile N Tabs." Three preset layouts: vertical split, horizontal split, and grid. Tiles are equal-sized by default. Drag dividers to resize.
- **Key UX decisions:** Creation via context menu on tab bar (not on the page). Grid layout auto-arranges based on count (2→side-by-side, 3→2+1, 4→2x2). Each tile is a full browser tab with its own address bar. Active tile has a colored top border.
- **Limitations:** No keyboard shortcut to create tile arrangements. No importance/weight system — all tiles start equal. Maximum practical limit is ~6 tiles before content is unreadable.

### Arc Browser (Split View)
- **How it works:** Click "+" in toolbar → split left/right. Or drag a tab to the side of the window. Each split is a full tab with independent navigation. Splits are stored per-space (workspace).
- **Key UX decisions:** Splits are binary — you split left or right, not into a grid. Creating a split from the sidebar makes it feel like a workspace operation, not a window management task. Splits persist across sessions.
- **Limitations:** Maximum 2 panes (no 3+ splits). No grid or masonry layout. No keyboard shortcut for creating splits.

### VSCode (Editor Split Groups)
- **How it works:** Cmd+\ splits the active editor. Cmd+1/2/3 focuses group 1/2/3. Drag tabs between groups. Groups can be arranged vertically, horizontally, or in a grid. Custom layouts via "Editor Layout" menu (2x2, 1+2, etc.).
- **Key UX decisions:** Binary tree model — each split creates two groups, either can be split again. Keyboard-first: Cmd+\ to split, Cmd+1-9 to focus, Ctrl+Shift+Arrow to move editors between groups. Focus indicator is a colored top border on the active group.
- **Limitations:** Complex layouts (3x3) get confusing. No "importance" weighting — all groups are equal unless manually resized.

### CSS Masonry Layout (Algorithm)
- **How it works:** Items pack into columns, filling gaps by tracking the "running height" of each column and placing the next item in the shortest column. No explicit rows — items flow like bricks in a wall.
- **Key UX decisions:** Items can have different heights (importance = height). Columns are equal width. The algorithm minimizes whitespace by filling the shortest column first. CSS `grid-template-rows: masonry` is the native spec (Firefox only as of 2026).
- **Limitations:** Equal-width columns only (no variable-width masonry in CSS). For variable-width + variable-height, need a JS layout algorithm. Content reflow on resize can feel jumpy.

### Native Browser Split (Chrome/Edge/Firefox)
- **How it works:** Chrome/Edge: drag tab to side of window for 50/50 split (OS-level snap). Firefox: emerging split view feature. Opera: built-in "Tab Islands" with grouped tiling.
- **Key UX decisions:** Browser-level split leverages OS window management. Simple 50/50 or 70/30 presets. No masonry or grid — always 2 panes.
- **Limitations:** OS-dependent behavior. No in-browser pane management. Can't do 3+ panes.

### Total Commander (Dual Pane Keyboard)
- **How it works:** Fixed dual-pane layout. Tab switches active pane. Ctrl+Left/Right swaps directories between panes. Each pane maintains independent state (directory, selection, sort order).
- **Key UX decisions:** Symmetric layout — both panes are always the same size. Tab is the only pane-switching key needed. The active pane has a highlighted header bar. Operations (F5=copy, F6=move) always go from active pane to inactive pane.
- **Limitations:** Fixed at 2 panes. No grid or masonry. No importance weighting.

## Common Patterns

1. **Creation:** Context menu on tabs (Vivaldi), keyboard shortcut (VSCode Cmd+\), drag to edge (Arc, Chrome). Most tools offer 2+ methods.
2. **Default layout is equal split.** Every tool starts with 50/50. Resizing via drag dividers is secondary.
3. **Active pane indicator:** Colored top border (Vivaldi, VSCode), highlighted header (Total Commander), or visual focus ring.
4. **Keyboard pane switching:** Tab (Total Commander, MC), Cmd+1-9 by position (VSCode), or no keyboard support (most browsers).
5. **Maximum practical panes:** 2 for simple comparison, 4 for monitoring dashboards, 6+ becomes unusable.
6. **Presets beat freeform:** Vivaldi's 3 presets (vertical/horizontal/grid) are more used than freeform arrangement. Users prefer choosing from layouts over building them.

## Risks & Edge Cases

- **Iframe isolation:** Each pane is an iframe. Cross-origin restrictions mean panes can't communicate or share state. This is fine — panes are independent views.
- **Minimum viable size:** Below ~300px width, most web content breaks. Need to enforce minimum pane dimensions.
- **Responsive content:** Pages designed for full-width will reflow when given 50% width. Some will break. Consider showing a zoom-out/scale option.
- **Focus management:** With multiple panes, keyboard events must route to the correct pane. The "active pane" concept must be visually obvious and keyboard-switchable.
- **Performance:** Multiple iframes = multiple render processes. 4+ simultaneous page loads will tax memory. Show loading states per-pane.
- **Mobile/narrow viewports:** Multi-pane doesn't work below ~768px. Need a fallback (tab switching instead of splitting).

## Key Takeaways

1. **Start with equal-split presets** (side-by-side, top-bottom, 2x2 grid) — don't build freeform layout first. Presets cover 90% of use cases.
2. **VSCode's keyboard model is the gold standard:** Cmd+\ to split, Cmd+1-9 to focus by position, Ctrl+Shift+Arrow to move tabs between panes. Adopt this directly.
3. **Importance/weight as a secondary feature:** Default to equal. Allow right-click → "Set importance" or drag dividers to adjust. The masonry algorithm fills space based on weight ratios.
4. **Context menu on workspace tree tabs** is the right creation point. "Open in new pane" / "Split right" / "Split below" as options.
5. **Active pane needs a strong visual indicator** — a colored top border (blue) plus a subtle background tint. Tab key to cycle between panes.
