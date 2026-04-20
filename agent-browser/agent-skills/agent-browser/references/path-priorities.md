# Path Priorities

Use these priorities to avoid scanning the wrong surface first.

- Stay inside the active workspace unless the task explicitly requires switching.
- Prefer open panes and selected worktree items before broad filesystem searches.
- Prefer durable files under `//workspace`, especially `//workspace/.agents`, before session filesystems.
- Prefer the session `/workspace` subtree before `/tmp` when looking for runtime artifacts.
- When a runtime path should reference a durable file, symlink the workspace file instead of copying it.