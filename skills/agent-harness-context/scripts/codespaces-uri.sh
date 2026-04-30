#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: codespaces-uri.sh [--public] [--check] PORT [PATH]

Build the forwarded GitHub Codespaces URL for a port and optional callback path.

Examples:
  codespaces-uri.sh 5174
  codespaces-uri.sh 5174 /auth/callback
  codespaces-uri.sh --public --check 5174 /auth/callback
EOF
}

make_public=false
check_url=false
args=()

while (($#)); do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --public)
      make_public=true
      ;;
    --check)
      check_url=true
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      args+=("$1")
      ;;
  esac
  shift
done

if (($#)); then
  args+=("$@")
fi

if [[ ${#args[@]} -lt 1 || ${#args[@]} -gt 2 ]]; then
  usage >&2
  exit 2
fi

port="${args[0]}"
path_part="${args[1]-}"

if ! [[ "$port" =~ ^[0-9]+$ ]]; then
  echo "PORT must be numeric, got: $port" >&2
  exit 2
fi

: "${CODESPACE_NAME:?Missing CODESPACE_NAME. Run this inside a GitHub Codespace.}"
: "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:?Missing GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN. Run this inside a GitHub Codespace.}"

if [[ -n "$path_part" && "$path_part" != /* ]]; then
  path_part="/$path_part"
fi

base_url="https://${CODESPACE_NAME}-${port}.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"

if $make_public; then
  command -v gh >/dev/null 2>&1 || {
    echo "gh CLI is required for --public" >&2
    exit 3
  }
  gh codespace ports visibility -c "$CODESPACE_NAME" "${port}:public" >/dev/null
fi

if $check_url; then
  status_code="$(curl -I -L -s -o /dev/null -w '%{http_code}' "$base_url")"
  if [[ "$status_code" =~ ^[23][0-9][0-9]$ ]]; then
    echo "Validated $base_url -> HTTP $status_code" >&2
  else
    if [[ "$status_code" == "401" ]]; then
      echo "Forwarded URL returned HTTP 401. Re-run with --public if browser access must work outside the container." >&2
    else
      echo "Forwarded URL check failed: $base_url -> HTTP $status_code" >&2
    fi
    exit 4
  fi
fi

printf '%s\n' "${base_url}${path_part}"