#!/usr/bin/env bash
set -euo pipefail

readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly EXTENSION_ROOT="$REPO_ROOT/tools/agent-browser-preview-extension"
readonly EXTENSION_SOURCE_DIR="$EXTENSION_ROOT/extension"

log() {
  printf '[agent-browser preview extension] %s\n' "$*"
}

if ! command -v code >/dev/null 2>&1; then
  log "Skipping install because 'code' is not available in this environment"
  exit 0
fi

if [[ ! -f "$EXTENSION_SOURCE_DIR/package.json" ]]; then
  log "Skipping install because extension sources are missing"
  exit 0
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

vsix_path="$tmp_dir/agent-browser-preview-extension.vsix"

mkdir -p "$tmp_dir/extension"
cp -R "$EXTENSION_SOURCE_DIR/." "$tmp_dir/extension/"

(
  cd "$tmp_dir"
  zip -qr "$vsix_path" extension
)

log 'Installing local helper extension'
code --install-extension "$vsix_path" --force >/dev/null
log 'Installed local helper extension'