#!/usr/bin/env bash
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly APP_DIR="$REPO_ROOT/agent-browser"
readonly HEALTH_URL="http://127.0.0.1:5174/"

log() {
  printf '[agent-browser dev] %s\n' "$*"
}

dependencies_ready() {
  [[ -d "$REPO_ROOT/node_modules" ]]
}

server_ready() {
  curl --silent --fail "$HEALTH_URL" >/dev/null 2>&1
}

if ! dependencies_ready; then
  log "Dependencies are missing in $REPO_ROOT/node_modules"
  log "Run 'npm ci' once from the repo root, or reopen the workspace after post-create finishes."
  exit 1
fi

if server_ready; then
  log 'Reusing existing server on port 5174'
  log 'Ready'
  exit 0
fi

log 'Starting Vite dev server on port 5174'
cd "$APP_DIR"
npm run dev &
child_pid=$!

cleanup() {
  if kill -0 "$child_pid" >/dev/null 2>&1; then
    kill "$child_pid" >/dev/null 2>&1 || true
  fi
}

trap cleanup INT TERM

for _attempt in $(seq 1 120); do
  if server_ready; then
    log 'Ready'
    wait "$child_pid"
    exit $?
  fi

  if ! kill -0 "$child_pid" >/dev/null 2>&1; then
    wait "$child_pid"
    exit $?
  fi

  sleep 1
done

log 'Timed out waiting for the Vite dev server to become ready'
cleanup
wait "$child_pid" || true
exit 1