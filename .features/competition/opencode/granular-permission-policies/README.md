# Granular Permission Policies

- Harness: OpenCode
- Sourced: 2026-04-28

## What it is
OpenCode exposes a policy system that controls whether specific actions run automatically, require approval, or are blocked.

## Evidence
- Official docs: [Permissions](https://opencode.ai/docs/permissions/)
- First-party details:
  - permission rules resolve to `allow`, `ask`, or `deny`
  - policies can be set globally and overridden per tool, path, command, or agent
  - available permission scopes include `bash`, `edit`, `read`, `task`, `skill`, `webfetch`, `external_directory`, and `doom_loop`
  - the docs show per-agent overrides for different trust levels

## Product signal
Competing harnesses are turning permissioning into a product surface instead of a hidden runtime safeguard.
