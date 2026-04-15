#!/usr/bin/env bash
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly START_SCRIPT="$REPO_ROOT/scripts/run-agent-browser-dev-server.sh"
readonly HEALTH_URL="http://127.0.0.1:5173/"
readonly LOG_FILE="${TMPDIR:-/tmp}/agent-browser-dev-server.log"

log() {
  printf '[devcontainer post-start] %s\n' "$*"
}

server_ready() {
  curl --silent --fail "$HEALTH_URL" >/dev/null 2>&1
}

if [[ ! -x "$START_SCRIPT" ]]; then
  log "Skipping agent-browser start because $START_SCRIPT is not executable"
  exit 0
fi

if server_ready; then
  log 'agent-browser dev server is already responding on port 5173'
  exit 0
fi

if pgrep -f "$START_SCRIPT" >/dev/null 2>&1; then
  log 'agent-browser dev server startup is already in progress'
  exit 0
fi

log 'Starting agent-browser dev server in the background'
nohup "$START_SCRIPT" >>"$LOG_FILE" 2>&1 &
log "agent-browser startup logs: $LOG_FILE"