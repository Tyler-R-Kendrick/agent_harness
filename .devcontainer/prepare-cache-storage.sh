#!/usr/bin/env bash
set -euo pipefail

CACHE_ROOT="${DEVCONTAINER_CACHE_ROOT:-/tmp/devcontainer-cache}"

mkdir -p \
  "$CACHE_ROOT/xdg" \
  "$CACHE_ROOT/npm" \
  "$CACHE_ROOT/uv" \
  "$CACHE_ROOT/ms-playwright"

relocate_to_tmp() {
  local source_path=$1
  local target_path=$2

  if [[ -L "$source_path" ]]; then
    return 0
  fi

  if [[ -e "$source_path" ]]; then
    mkdir -p "$(dirname "$target_path")"
    if [[ ! -e "$target_path" ]]; then
      mv "$source_path" "$target_path"
    elif [[ -d "$source_path" && -d "$target_path" ]]; then
      cp -a "$source_path"/. "$target_path"/
      rm -rf "$source_path"
    else
      rm -rf "$source_path"
    fi
  fi

  ln -sfn "$target_path" "$source_path"
}

relocate_to_tmp "$HOME/.cache" "$CACHE_ROOT/xdg"
relocate_to_tmp "$HOME/.npm" "$CACHE_ROOT/npm"