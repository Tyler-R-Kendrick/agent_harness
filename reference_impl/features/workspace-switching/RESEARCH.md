# Research: Workspace Hot-Swapping

## Prior Art

### Windows 10/11 Virtual Desktops
- **Switching**: Win+Ctrl+Left/Right arrows for sequential navigation; Win+Tab opens Task View with thumbnails
- **Creation/Deletion**: Win+Ctrl+D creates instantly; Win+Ctrl+F4 closes current and migrates to adjacent
- **State**: Each desktop maintains independent window layout; persists across sessions
- **Indicator**: No persistent indicator — Task View must be opened to see position
- **Limitations**: Linear-only arrangement; no app pinning; sequential switching slow at 5+ desktops; no persistent status bar indicator causes context confusion

### macOS Mission Control / Spaces
- **Switching**: Ctrl+Left/Right arrows; three-finger trackpad swipe; Ctrl+Up opens Mission Control overview
- **Creation**: (+) button in Mission Control top-right; modal interaction required
- **State**: Independent per-space window layout; apps pinnable to specific or all spaces via Dock
- **Indicator**: No persistent menu bar indicator; Mission Control grid is modal
- **Limitations**: App-level pinning only (not window-level); gesture-based discovery fails for keyboard users; modal overview interrupts workflow

### Linux (GNOME / KDE)
- **Switching**: Ctrl+Alt+Left/Right (GNOME); Ctrl+Meta+arrows (KDE supports 2D grid)
- **Creation**: Settings panel or dynamic creation depending on DE
- **Indicator**: Workspace switcher overlay varies by DE; some show persistent panel widget
- **Key difference**: KDE supports 2D grid layout, avoiding the linear-only limitation

### Arc Browser Spaces
- **Switching**: Click space in left sidebar (mouse-dependent; no documented keyboard shortcut)
- **Creation**: (+) button at sidebar bottom
- **State**: Each space has unique color theme + custom icon; tab state fully isolated per space
- **Indicator**: Always-visible sidebar with color-coded pills — best persistent indicator design observed
- **Limitations**: Mouse-dependent; poor keyboard accessibility; Arc itself transitioning away from this model

### Vivaldi Workspaces
- **Switching**: Click workspace button in tab bar; Ctrl+Shift+[1-9] for numbered access; scroll wheel cycling
- **Creation**: Workspace button > New Workspace; choose empty or move current tabs
- **State**: Tab count per workspace visible in menu; custom icons and color themes
- **Indicator**: Numbered pills with icons always visible in tab bar
- **Key strength**: Combines visual indicator with keyboard shortcuts (Ctrl+Shift+1-9)

### VS Code Workspaces
- **Switching**: File > Open Workspace (window-level, not hot-swap); extensions add faster UI
- **State**: .code-workspace files with folder references, settings, extension state
- **Limitation**: Heavyweight switching (opens new window); designed for project isolation, not rapid context switching

## Common Patterns

1. **Two-tier navigation**: Sequential (arrow keys) for adjacent workspaces + direct jump (number keys) for random access
2. **Persistent vs. modal indicator**: Browser implementations (Arc, Vivaldi) use always-visible sidebar indicators; OS implementations hide state behind modal overlays
3. **Single-keystroke creation**: Windows (Win+Ctrl+D) is the gold standard for instant workspace creation
4. **Tab/window isolation**: Each workspace maintains independent content layout that persists when switching away
5. **Color + icon theming**: Arc and Vivaldi use visual differentiation (color, icon) to reduce cognitive load when identifying workspaces

## Risks & Edge Cases

- **Scalability**: Dot-based indicators break at 8+ workspaces; numbered shortcuts max at 9
- **State confusion**: Without persistent indicator, users lose track of which workspace they're in
- **Memory pressure**: Each workspace maintains full tab state; hibernation/memory tiers need per-workspace management
- **Keyboard conflicts**: Modifier+arrow combos may conflict with existing tree navigation; need non-overlapping shortcut namespace
- **Empty workspace deletion**: Accidentally deleting a workspace with content is destructive; need confirmation or undo
- **Cross-workspace references**: User may want certain tabs (e.g., chat, docs) visible across all workspaces (pinning pattern)

## Key Takeaways

1. **Persistent visual indicator is mandatory** — Arc/Vivaldi sidebars dramatically outperform hidden OS indicators
2. **Hybrid input: sidebar + numbered shortcuts** (Ctrl/Cmd+[1-9] or similar) covers both mouse and keyboard users
3. **Instant creation** (single keystroke) encourages experimentation; modal creation discourages it
4. **Sequential + direct access** both needed — arrows for adjacent, numbers for jump
5. **Color/icon differentiation** reduces cognitive load more than text labels alone
