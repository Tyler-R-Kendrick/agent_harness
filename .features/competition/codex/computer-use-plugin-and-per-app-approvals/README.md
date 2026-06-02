# Computer Use Plugin And Per-App Approvals

- Harness: Codex
- Sourced: 2026-06-02

## What it is
Codex app can operate desktop applications through Computer Use, with app-scoped approvals on macOS and newer Windows-host support for cross-device remote workflows.

## Evidence
- Official docs: [Computer Use](https://developers.openai.com/codex/app/computer-use)
- Official release notes: [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- First-party details:
  - users install the Computer Use plugin from Codex settings before delegating GUI work
  - macOS Screen Recording and Accessibility permissions let Codex see and operate target apps
  - prompts can explicitly invoke `@Computer` or a specific app like `@Chrome`
  - Codex asks permission before using an app and supports an `Always allow` list per application
  - eligible Mac users can keep Computer Use running remotely after the Mac locks
  - as of May 29, 2026 Codex also supports Computer Use on Windows hosts, with remote follow-through from ChatGPT mobile or Codex on Mac while the Windows machine remains the execution host
  - Computer Use on Windows launched with regional restrictions and separate early-access gating for some enterprise environments
- Latest development checkpoint:
  - the current product framing is not generic desktop automation; it is governed, host-aware computer control that now spans both Mac and Windows surfaces while keeping execution attached to the underlying machine

## Product signal
Codex is treating GUI automation as a durable execution plane with explicit host, approval, and remote-supervision semantics rather than a one-off desktop macro layer.
