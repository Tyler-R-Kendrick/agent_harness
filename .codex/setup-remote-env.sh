#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '[codex setup] %s\n' "$*"
}

log "Clearing inherited npm/node proxy configuration"
unset HTTP_PROXY HTTPS_PROXY NO_PROXY http_proxy https_proxy no_proxy
npm config delete proxy >/dev/null 2>&1 || true
npm config delete https-proxy >/dev/null 2>&1 || true
npm config set proxy null >/dev/null 2>&1 || true
npm config set https-proxy null >/dev/null 2>&1 || true

log "Preparing cache directories"
mkdir -p /tmp/devcontainer-cache/{xdg,npm,uv,ms-playwright}

export XDG_CACHE_HOME="${XDG_CACHE_HOME:-/tmp/devcontainer-cache/xdg}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/devcontainer-cache/npm}"
export UV_CACHE_DIR="${UV_CACHE_DIR:-/tmp/devcontainer-cache/uv}"
export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/tmp/devcontainer-cache/ms-playwright}"

if [ -x "$ROOT_DIR/.devcontainer/prepare-cache-storage.sh" ]; then
  log "Normalizing cache symlinks"
  "$ROOT_DIR/.devcontainer/prepare-cache-storage.sh"
fi

log "Enabling Node package manager shims"
corepack enable

log "Installing workspace dependencies"
npm install --prefix "$ROOT_DIR"

if [ -f "$ROOT_DIR/agent-browser/package.json" ]; then
  log "Installing Playwright browsers for agent-browser"
  npm --prefix "$ROOT_DIR/agent-browser" exec playwright install --with-deps
fi

log "Setup complete"
