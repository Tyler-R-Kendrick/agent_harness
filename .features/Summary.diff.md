# Summary Diff For Linear Feature Generation

Updated: 2026-04-29
Baseline: `.features/Summary.md` updated from the 2026-04-28 ten-harness corpus.
Diff type: additive update after T3 Code research

## Net new normalized features

### Expanded: Parallel agent orchestration
- Why now: T3 Code shows that even early GUI harnesses are making branch/worktree-aware thread spawning a visible primitive instead of burying isolation in backend implementation details.
- Research delta:
  - T3 Code documents `chat.new` preserving branch/worktree state and `chat.newLocal` creating a new environment for the active project.

### Expanded: Skills and reusable browser workflows
- Why now: T3 Code adds provider-level skill discovery, reinforcing that capability packaging is becoming part of the agent-selection and routing layer itself.
- Research delta:
  - the 2026-04-17 `v0.0.19` release notes include `Add provider skill discovery`

### Expanded: Multi-surface continuity
- Why now: T3 Code makes remote-pairing and headless access explicit product features, which strengthens the case that browser-oriented harnesses should not assume a single local UI.
- Research delta:
  - `t3 serve` emits pairing tokens, pairing URLs, and QR codes for another device
  - desktop settings can expose the local backend and generate a shareable pairing link

### Added: Remote pairing and traceable long-running sessions
- Why now: T3 Code pairs device-to-device access with a concrete observability model, which is a useful pattern for remote browser agents.
- Linear issue title:
  - `Add remote pairing for browser-agent sessions`
- Suggested problem statement:
  - Browser-agent runs are still anchored to one local UI, making handoff, phone access, and remote supervision harder than they need to be.
- One-shot instruction for an LLM:
  - Design and implement remote pairing for browser-agent sessions with one-time pairing links or QR codes, device/session management, revoke flows, and safe auth boundaries so a user can supervise the same run from another trusted device.

### Added: Structured local traces for agent operations
- Linear issue title:
  - `Record browser-agent traces for debugging`
- Suggested problem statement:
  - Long-running browser automations are difficult to debug because logs are transient and execution context is spread across UI state, console output, and ad hoc screenshots.
- One-shot instruction for an LLM:
  - Build a structured tracing pipeline for browser-agent operations that writes persisted local trace records with timing, parent-child spans, tool metadata, and embedded log events, plus optional OTLP export for deeper inspection in external observability backends.

### Added: Command palette and shortcut-driven workflow packs
- Linear issue title:
  - `Expose browser workflows through commands and shortcuts`
- Suggested problem statement:
  - Reusable browser workflows are slower to invoke when they only exist as prompts or hidden scripts instead of first-class commands.
- One-shot instruction for an LLM:
  - Add a command palette, customizable keybindings, and script-backed command entries for browser workflows so users can launch common actions, switch projects, spawn fresh runs, and open preferred editors without retyping prompts.

## How to use this file

1. Treat each `Added:` section as a candidate Linear epic or feature.
2. Convert the `Linear issue title` into the issue title.
3. Use the `Suggested problem statement` as the issue body opener.
4. Paste the `One-shot instruction for an LLM` into implementation planning or issue enrichment.

## Recommended next Linear batch

1. `Add remote pairing for browser-agent sessions`
2. `Record browser-agent traces for debugging`
3. `Expose browser workflows through commands and shortcuts`
