# Browser Surface Runtime Inline And Popup

- Harness: Space Agent
- Sourced: 2026-04-30

## What it is
Space Agent recently reworked web browsing around registered browser surfaces so popup windows and inline browser widgets share one runtime model and API.

## Evidence
- Official releases: [agent0ai/space-agent releases](https://github.com/agent0ai/space-agent/releases)
- Official README: [agent0ai/space-agent](https://github.com/agent0ai/space-agent)
- First-party details:
  - the `v0.64` release says web browsing moved from a window-centric model to a registered browser-surface model
  - the same release says popup windows and inline `<x-browser>` elements now share a common API and lifecycle
  - `space.browser` access is now id-based rather than attached to a single window handle
  - the release notes also mention updated prompt construction around currently open and last interacted browser surfaces
- Latest development checkpoint:
  - Space Agent shipped this browser-surface rearchitecture on April 23, 2026, which is recent enough to treat as current product direction rather than old architecture trivia

## Product signal
Space Agent is converging browser automation and UI composition into one surface model, which is especially relevant for browser-native agent products.
