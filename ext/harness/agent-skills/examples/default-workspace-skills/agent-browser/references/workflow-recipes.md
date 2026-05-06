# Workflow Recipes

Use these recipes when the task maps cleanly to an existing `agent-browser` workflow.

## Inspect the active workspace

1. Call `list_render_panes`.
2. Call `list_worktree_items`.
3. Call `list_filesystem_entries` with `targetType: "workspace-file"`.
4. Read specific files only after you know which workspace artifact matters.

## Edit a default bundled skill

1. List workspace files with a query such as `.agents/skills/agent-browser`.
2. Read the specific file under the active workspace copy.
3. Modify the workspace file rather than duplicating the content into a session filesystem.

## Inspect runtime output

1. List sessions.
2. Read the session you care about.
3. Mount the session filesystem if needed.
4. Inspect the `/workspace` subtree before browsing temporary runtime paths.

## Link durable files into runtime

1. Confirm the session filesystem is mounted.
2. Use a symlink operation instead of copying the workspace file.
3. Keep the workspace file as the durable source of truth.