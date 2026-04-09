# Research: Workspace Keyboard Navigation & Tab Management

## Prior Art

### Total Commander (Dual-Pane Power File Manager)
- **How it works:** Dual-pane layout. Tab key switches active pane. Arrow keys navigate files. F-keys for operations (F5=copy, F6=move). Selection independent from cursor — you can mark items and keep moving.
- **Key UX decisions:** Every operation has a keyboard shortcut. No mouse required for any workflow. Active pane is visually distinct. Operations default to using the other pane as the destination.
- **Limitations:** Steep learning curve. No drag-drop — entirely keyboard/shortcut driven. Fixed dual-pane model doesn't adapt to tree hierarchies.

### Midnight Commander (Terminal File Manager)
- **How it works:** Dual-pane in terminal. Arrow keys + Enter for navigation. Tab switches panes. F1-F10 bar at bottom shows available operations. ".." entry navigates up.
- **Key UX decisions:** Function key bar visible at all times — discoverability baked in. PgUp/PgDn for fast scrolling. Esc as Meta-key alternative.
- **Limitations:** Terminal constraints limit visual feedback. No multi-select via shift-arrow (uses Insert key instead).

### Ranger (Vim-Style Console File Manager)
- **How it works:** Three-column layout (parent/current/preview). hjkl vim navigation. / for search. yy/dd/pp for copy/cut/paste. : for command mode.
- **Key UX decisions:** Vim muscle memory = zero learning curve for vim users. Three-column preview gives context without opening files. Fully programmable keybindings.
- **Limitations:** Vim-only bindings alienate non-vim users. No visual drag-drop. Single-pane model.

### VSCode Tree View
- **How it works:** Arrow keys navigate tree. Right expands, Left collapses. Type-to-navigate: start typing and a filter widget appears, narrowing visible items. Tab moves focus between UI sections.
- **Key UX decisions:** Type-to-navigate is the killer feature — makes large trees usable without scrolling. Focus management follows WAI-ARIA treeview pattern. Screen reader optimized.
- **Limitations:** Tree tooltips don't appear on keyboard navigation. Keyboard-only users can't drag the sidebar separator. No multi-select in the file explorer tree.

### Vivaldi Browser (Tab Stacking)
- **How it works:** Ctrl+1-8 jumps to tab/stack by position. Ctrl+9 for last tab. Shift+Click multi-selects tabs for grouping. Tab stacks collapse/expand. Quick Commands (F2) for fuzzy search across everything.
- **Key UX decisions:** Position-indexed shortcuts (Ctrl+1-8) for instant access to groups. All browser actions remappable. Quick Commands as universal fuzzy finder.
- **Limitations:** No default keyboard shortcut to create stacks. Grouping requires mouse (Shift+Click then right-click menu).

### WAI-ARIA Treeview Pattern (Accessibility Standard)
- **How it works:** Defines the keyboard contract for tree UIs: Up/Down navigate items, Right expands, Left collapses, Home/End jump to first/last, type-ahead selects matching items. Two focus strategies: roving tabindex or aria-activedescendant.
- **Key requirements:** role="tree" on container, role="treeitem" on items, aria-expanded for node state, aria-selected for selection. Browsers provide ZERO default keyboard support — all must be implemented in JS.

### Keyboard-Accessible Drag & Drop (React Spectrum / Adobe)
- **How it works:** Enter to start drag mode → Tab cycles through valid drop targets only → Enter to drop → Escape to cancel. Clear visual state during drag mode.
- **Key UX decisions:** Drag mode is a modal interaction — only drop targets are tabbable. Alternative to mouse drag that provides equivalent functionality.
- **Limitations:** Complex to implement. Not intuitive without onboarding. Must provide alternative (cut/paste) for simpler cases.

## Common Patterns

1. **Arrow keys are universal:** Up/Down to move, Right to expand, Left to collapse. Every tool uses this.
2. **Selection is independent from cursor:** Power tools (TC, MC, Ranger) separate "where I am" from "what I've selected." This enables batch operations.
3. **Tab switches context:** Tab moves between panes (TC, MC) or UI sections (VSCode). Never used for in-tree navigation.
4. **Position-indexed shortcuts:** Ctrl+1-9 for instant group access (Vivaldi). The "superuser" pattern for known layouts.
5. **Type-to-navigate/filter:** Start typing to narrow items (VSCode). Essential for large trees.
6. **Function keys for operations:** F2=rename, F5=copy, F6=move, F7=new folder, F8=delete (TC/MC convention).
7. **Keyboard drag-drop = Enter/Tab/Enter:** Modal interaction where Enter starts, Tab navigates targets, Enter confirms, Escape cancels.

## Risks & Edge Cases

- **Keybinding conflicts:** Browser shortcuts (Ctrl+T, Ctrl+W) will conflict with workspace shortcuts. Need a namespace strategy (e.g., Alt+ prefix or mode-switching).
- **Focus traps:** When keyboard focus enters the tree, it must be possible to leave it (Tab out). Avoid trapping focus inside deeply nested trees.
- **Screen reader compatibility:** aria-activedescendant approach is more compatible with screen readers than roving tabindex for dynamically updating trees.
- **Deep nesting:** Trees with 5+ levels become hard to navigate with Left/Right alone. Need jump-to-parent and jump-to-root shortcuts.
- **Performance:** Keyboard repeat rate means rapid up/down keystrokes. Tree rendering must stay under 16ms per frame during held-key navigation.
- **Discovery:** Power shortcuts are useless if users don't know they exist. Need a discoverable shortcut reference (? key or Ctrl+/).

## Key Takeaways

1. **Two focus concepts:** "Cursor" (where you are) and "Selection" (what you've marked). Both must be visually distinct and independently controlled.
2. **Position-indexed groups (Ctrl+1-9)** are the superuser pattern — instant access to workspace folders by position. Must support reordering.
3. **Type-to-navigate** is essential for trees larger than ~20 items. Filter the tree as the user types, not just highlight matches.
4. **Keyboard move = cut/paste model**, not drag-drop simulation. Enter to grab, navigate to target, Enter to place. Simpler and more discoverable than modal drag mode.
5. **Discoverable shortcut overlay** (triggered by ? or Ctrl+/) is mandatory. Without it, power features are invisible.
