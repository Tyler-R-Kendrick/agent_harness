#!/usr/bin/env bash
set -uo pipefail

log() {
  echo "[devcontainer post-create] $*"
}

prune_workspace_node_modules() {
  local workspace_dir

  for workspace_dir in "$REPO_ROOT/agent-browser" "$REPO_ROOT"/lib/*; do
    if [ -d "$workspace_dir/node_modules" ]; then
      log "Removing stale workspace-local dependencies from ${workspace_dir#$REPO_ROOT/}"
      rm -rf "$workspace_dir/node_modules"
    fi
  done
}

run_with_timeout() {
  local seconds=$1
  shift
  if timeout "$seconds" "$@"; then
    return 0
  else
    local code=$?
    if [ $code -eq 124 ]; then
      log "WARNING: command timed out after ${seconds}s: $*"
    else
      log "WARNING: command failed (exit $code): $*"
    fi
    return 0  # don't abort the whole script
  fi
}

export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -x "$REPO_ROOT/.devcontainer/prepare-cache-storage.sh" ]; then
  log "Relocating cache directories onto /tmp storage"
  "$REPO_ROOT/.devcontainer/prepare-cache-storage.sh"
fi

# ── Serena ────────────────────────────────────────────────────────────────────
log "Installing or upgrading Serena agent via uv"
run_with_timeout 180 uv tool install -p 3.13 serena-agent@latest --prerelease=allow --upgrade

export PATH="$HOME/.local/bin:$PATH"

if command -v serena >/dev/null 2>&1; then
  log "Initializing Serena global config"
  run_with_timeout 30 serena init
else
  log "Skipping Serena init: 'serena' not on PATH"
fi

# ── Rust Token Killer ─────────────────────────────────────────────────────────
if ! command -v rtk >/dev/null 2>&1; then
  log "Installing Rust Token Killer"
  run_with_timeout 180 sh -c \
    "$(curl --connect-timeout 15 -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh)"
  export PATH="$HOME/.cargo/bin:$PATH"
else
  log "Rust Token Killer already installed"
fi

if command -v rtk >/dev/null 2>&1; then
  log "Initializing RTK globally"
  run_with_timeout 30 rtk init --global
else
  log "Skipping RTK init: 'rtk' not on PATH"
fi

# ── npm Workspaces -----------------------------------------------------------
if [ ! -d "$REPO_ROOT/node_modules" ]; then
  prune_workspace_node_modules
  log "Installing shared npm workspace dependencies"
  run_with_timeout 600 npm install --prefix "$REPO_ROOT"
else
  log "Shared npm workspace dependencies are current"
fi

if [ -x "$REPO_ROOT/scripts/install-agent-browser-preview-extension.sh" ]; then
  log "Installing agent-browser preview helper extension"
  run_with_timeout 120 "$REPO_ROOT/scripts/install-agent-browser-preview-extension.sh"
else
  log "Skipping preview helper extension install: script is not executable"
fi

log "Post-create complete"
