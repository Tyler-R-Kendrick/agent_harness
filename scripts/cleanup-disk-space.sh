#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

remove_path() {
  local target=$1
  if [[ -e "$target" || -L "$target" ]]; then
    rm -rf "$target"
    printf 'removed %s\n' "$target"
  fi
}

remove_path "$REPO_ROOT/.playwright-mcp"
remove_path "$REPO_ROOT/agent-browser/node_modules"
remove_path "$REPO_ROOT/agent-browser/coverage"
remove_path "$REPO_ROOT/agent-browser/test-results"
remove_path "$REPO_ROOT/agent-browser/dist"

while IFS= read -r generated_dir; do
  remove_path "$generated_dir"
done < <(find "$REPO_ROOT/lib" -mindepth 2 -maxdepth 2 \( -name coverage -o -name node_modules \) -print)

for image in \
  "$REPO_ROOT/agent-browser-running.png" \
  "$REPO_ROOT/agent-browser-chat-ui-validation.png" \
  "$REPO_ROOT/agent-browser-after-continue.png" \
  "$REPO_ROOT/agent-browser-live-check.png" \
  "$REPO_ROOT/agent-browser-delegation-thoughts.png" \
  "$REPO_ROOT/chat-pane-close-buttons.png" \
  "$REPO_ROOT/file-editor-edit-mode.png" \
  "$REPO_ROOT/file-editor-label-mode.png"; do
  remove_path "$image"
done