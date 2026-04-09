# Feature Spec: Workspace Keyboard Navigation & Tab Management

## Problem Statement

When a user navigates to a new URL, the resulting page has no home in the workspace tree — it exists only as a floating overlay. There's no way to organize it without pre-creating a folder. Additionally, the workspace tree has no concept of a "selected" or "focused" node, so there's no keyboard navigation, no hotkey control, and no way for power users to manage their workspace without a mouse. This blocks accessibility, slows down expert users, and makes the workspace tree feel like a static display rather than an interactive control surface.

## User Flow

### Flow A: New Navigation Creates an Ungrouped Tab

1. User enters a URL in the omnibar or clicks a link in chat.
2. Page overlay opens as before.
3. A new tab node appears at the **bottom of the root workspace** in an "Ungrouped" section — visually distinct (no folder, slightly indented, faded divider above).
4. The new tab is automatically **selected** (cursor focus moves to it in the tree).
5. User can drag the tab into any folder, or use keyboard shortcuts to move it.

### Flow B: Keyboard Tree Navigation

1. User presses **Alt+1** (or clicks the tree). Focus enters the workspace tree. A visible **cursor highlight** appears on the first item.
2. **Arrow Up/Down** moves the cursor through visible items (respects collapsed folders — skips children of collapsed nodes).
3. **Arrow Right** on a folder expands it. On an already-expanded folder, moves cursor to first child.
4. **Arrow Left** on a child item moves cursor to parent folder. On an expanded folder, collapses it.
5. **Home/End** jumps to first/last visible item.
6. **Enter** on a tab opens it (shows page overlay). On a folder, toggles expand/collapse.
7. The cursor item has a distinct visual highlight (thin left border + background tint). It persists even when focus is elsewhere — the cursor position is remembered.

### Flow C: Keyboard Multi-Select & Move

1. User navigates to an item with arrow keys.
2. **Space** toggles selection on the cursor item (adds/removes from selection set). Cursor can then move without losing selection.
3. **Shift+Arrow** extends selection from cursor position (range select).
4. **Ctrl+A** selects all visible items.
5. **Escape** clears selection.
6. With items selected, **Ctrl+X** enters "move mode." Selected items get a dashed border and reduced opacity.
7. User navigates to a destination folder. **Ctrl+V** drops the items into that folder. Items animate into their new position.
8. **Escape** cancels move mode.

### Flow D: Position-Indexed Group Access

1. Workspace folders at the root level are implicitly numbered by position (1, 2, 3...).
2. **Ctrl+1** through **Ctrl+8** jumps cursor to root-level folder N and expands it.
3. **Ctrl+9** jumps to the last root-level folder.
4. Small position badges (1, 2, 3...) appear next to root folders when Alt is held, showing the index mapping.
5. These shortcuts also work from anywhere in the UI — they're global.

### Flow E: Type-to-Navigate

1. While the tree has focus, user starts typing any characters.
2. A small filter input appears at the top of the tree (overlaying the stats row).
3. The tree filters to show only matching items (name match). Non-matching items and empty folders are hidden.
4. Arrow keys navigate among matches. Enter opens the highlighted match. Escape clears the filter and restores the full tree.

### Flow F: Keyboard Shortcut Reference

1. User presses **?** (when tree is focused) or **Ctrl+/** (global).
2. A compact overlay appears listing all keyboard shortcuts grouped by category: Navigation, Selection, Operations, Quick Access.
3. Pressing any key or Escape dismisses it.

## States & Transitions

| State | Description | Trigger | Visual |
|-------|-------------|---------|--------|
| Idle | Tree visible, no cursor | Page load | Normal tree rendering |
| Focused | Cursor visible on an item | Alt+1 or click tree, Tab into tree | Blue left-border + subtle bg highlight on cursor item |
| Selected | One or more items marked | Space on cursor item | Checkmark indicator + tinted bg on selected items |
| Range-selecting | Extending selection | Shift+Arrow | Selection highlight extends from anchor to cursor |
| Move mode | Selected items being relocated | Ctrl+X | Dashed border + reduced opacity on source items, "Moving N items" badge |
| Drop preview | Cursor on target folder in move mode | Navigate in move mode | Target folder gets a drop indicator (blue bottom border) |
| Type-to-navigate | Filter active | Start typing in focused tree | Filter input visible, tree filtered |
| Shortcut overlay | Help overlay visible | ? or Ctrl+/ | Semi-transparent overlay with shortcut list |

## Inputs & Outputs

**Inputs:**
- Keyboard events (arrow keys, modifiers, alphanumeric for type-to-navigate)
- URL navigation events (from omnibar, chat links, page links)
- Drag-drop mouse events (as alternative to keyboard move)

**Outputs:**
- Updated workspace tree (new tabs added, items moved between folders)
- Cursor position (persisted in component state)
- Selection set (transient, cleared on navigation)
- Active tab (which page overlay is shown)

## Interaction Details

### Cursor vs Selection
The cursor is **where you are** — a single item. It's shown as a subtle highlight (2px left border, very light background). The selection is **what you've marked** — zero or more items. Selected items have a checkbox indicator and slightly tinted background. These are independent: you can select item A, move cursor to item B, and item A remains selected.

### Keyboard Shortcuts (Complete Map)

**Navigation:**
| Key | Action |
|-----|--------|
| Arrow Up/Down | Move cursor |
| Arrow Right | Expand folder / move to first child |
| Arrow Left | Collapse folder / move to parent |
| Home | Jump to first item |
| End | Jump to last item |
| Enter | Open tab / toggle folder |
| Page Up/Down | Move cursor by 10 items |

**Selection:**
| Key | Action |
|-----|--------|
| Space | Toggle select on cursor item |
| Shift+Arrow Up/Down | Extend selection |
| Ctrl+A | Select all visible |
| Escape | Clear selection / cancel mode |

**Operations:**
| Key | Action |
|-----|--------|
| Ctrl+X | Enter move mode (cut) |
| Ctrl+V | Drop items at cursor location |
| Delete / Backspace | Close/remove selected tabs |
| F2 | Rename cursor item |
| F7 | New folder at cursor location |

**Quick Access (Global):**
| Key | Action |
|-----|--------|
| Ctrl+1-8 | Jump to root folder by position |
| Ctrl+9 | Jump to last root folder |
| Alt+1 | Focus workspace tree |
| ? (in tree) | Show shortcut reference |
| Ctrl+/ (global) | Show shortcut reference |

### Drag & Drop (Mouse)
- Drag a tab by its row. While dragging, folders highlight as valid drop targets.
- Drop on a folder to move the tab into it. Drop between items to reorder.
- Drop indicator: blue horizontal line between items for position, or folder highlight for "into folder."
- The drag handle is the entire row (not a specific grip icon) — consistent with the cursor-row interaction model.

### Ungrouped Section
- New tabs from URL navigation land in a flat list at the bottom of the root workspace, below all folders.
- Visually separated by a thin divider and an "Ungrouped" label (very subtle, 10px uppercase).
- Ungrouped tabs participate in all selection/move operations like any other item.
- If the user moves all ungrouped tabs into folders, the section disappears.

### Accessibility (WAI-ARIA)
- `role="tree"` on the tree container, `role="treeitem"` on each node.
- `aria-expanded` on folders, `aria-selected` on selected items.
- `aria-activedescendant` on the tree pointing to the cursor item (preferred over roving tabindex for dynamic trees).
- `aria-label="Workspace tree"` on the container.
- All keyboard shortcuts have visible tooltips on hover.
- Focus ring visible on cursor item for high-contrast modes.

## Non-Goals (v1)

- Vim-style hjkl bindings (can add as a preference later)
- Custom keybinding remapping UI
- Multi-cursor (only one cursor position at a time)
- Drag-drop between separate browser windows
- Undo/redo for move operations
- Keyboard-driven tab reordering within a folder (move up/down within same parent)

## Open Questions

1. Should Ctrl+1-9 conflict with browser's native tab switching? In a Chromium fork we control these, but in the prototype we'd need a different modifier (Alt+1-9?).
2. Should new tabs from navigation go to "Ungrouped" always, or should there be a "default folder" preference?
3. Should type-to-navigate filter the tree or just highlight matches (VSCode highlights but can also filter)?
