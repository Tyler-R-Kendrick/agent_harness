# Windows Explorer Worktree Hotkey Parity

Date: 2026-05-14

Source: Microsoft Support, "Keyboard shortcuts in Windows"  
https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec

This matrix tracks File Explorer-style tree hotkeys that should work when focus is in the Agent Browser worktree.

| Explorer shortcut | Explorer behavior | Agent Browser worktree behavior |
| --- | --- | --- |
| Up / Down | Move focus through items | Move the tree cursor through visible worktree items. |
| Ctrl+Up / Ctrl+Down | Move focus without changing selection | Move the tree cursor while preserving the current selection. |
| Shift+Up / Shift+Down | Extend selection | Extend selection from the anchor to the new cursor item. |
| Space / Ctrl+Space | Select or clear the focused item | Toggle the cursor item in the selection set. |
| Ctrl+A | Select all | Select all visible worktree items. |
| Home / End | First or last item | Move the tree cursor to the first or last visible item. |
| Right | Expand or enter | Expand a collapsed folder, then move to its first child. |
| Left | Collapse or go to parent | Collapse an expanded folder, then move to its parent. |
| Alt+Up / Backspace | Go to parent or previous location | Move the tree cursor to the parent item when the filter is empty; Backspace edits the filter when text is present. |
| Enter | Open selected item | Open tabs/files or toggle folders. |
| F2 | Rename | Rename workspaces, sessions, and session filesystem entries when rename is available. Workspace files open their editable path field. |
| Alt+Enter | Properties | Open the selected item's Properties dialog. |
| Shift+F10 / Menu key | Context menu | Open the selected item's context menu at the tree row. |
| Delete / Ctrl+D | Delete | Delete selected browser tabs, sessions, workspace files, and deletable session filesystem entries; keep non-deletable selected items. |
| Shift+Delete | Permanently delete | Same as Delete because Agent Browser worktree items do not use a recycle-bin staging area. |
| Ctrl+C | Copy | Copy selected item references, paths, or URLs to the system clipboard and clipboard history. |
| Ctrl+X | Cut | Stage selected movable items for worktree paste. |
| Ctrl+V | Paste | Move staged cut items into the target workspace. |
| F5 | Refresh | Refresh the tree state without reloading the app shell. |
| Esc | Cancel | Clear selection, filters, overlays, transient menus, and open worktree panels. |

Explorer shortcuts that are window, address-bar, preview-pane, or desktop-shell commands remain outside the Agent Browser worktree surface: examples include Alt+D, Ctrl+E/Ctrl+F, Ctrl+N, Ctrl+W, Alt+P, F3, F4, F6, F11, and Ctrl+mouse-wheel view resizing. The worktree keeps those out of the tree handler so they can remain available to browser/app chrome.

Notes:
- Delete is capability-aware. Workspace category folders, drive roots, clipboard nodes, artifact references, and extension-locked workspace files are skipped instead of removed.
- Multi-selection deletion is batched so every eligible selected item is handled from the same command.
- Agent Browser does not mirror Explorer's filesystem recycle bin because worktree nodes represent mixed app objects, virtual session filesystem entries, and workspace records.
