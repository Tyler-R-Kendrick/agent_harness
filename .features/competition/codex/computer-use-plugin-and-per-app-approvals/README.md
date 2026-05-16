# Computer Use Plugin And Per-App Approvals

- Harness: Codex
- Sourced: 2026-05-16

## What it is
Codex app can operate desktop applications through a Computer Use plugin, gated by macOS system permissions and Codex-managed per-app approvals.

## Evidence
- Official docs: [Computer Use](https://developers.openai.com/codex/app/computer-use)
- First-party details:
  - users install the Computer Use plugin from Codex settings before delegating GUI work
  - macOS Screen Recording and Accessibility permissions let Codex see and operate target apps
  - prompts can explicitly invoke `@Computer` or a specific app like `@Chrome`
  - Codex asks permission before using an app and supports an `Always allow` list per application
  - sensitive or disruptive actions can still trigger additional confirmation
- Latest development checkpoint:
  - the current product framing is not generic "computer use"; it is app-scoped, approval-aware desktop control layered on top of the normal thread sandbox

## Product signal
Codex is treating GUI automation as a governed extension of the agent runtime, with narrower app-level trust boundaries than blanket desktop control.
