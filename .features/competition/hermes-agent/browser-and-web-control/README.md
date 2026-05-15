# Browser And Web Control

- Harness: Hermes Agent
- Sourced: 2026-05-15

## What it is
Hermes ships browser automation as part of the main harness, with local browser control, attached Chrome sessions, web extraction, screenshots, and vision-aware tool use.

## Evidence
- Official site: [Hermes Agent](https://hermes-agent.org/)
- Official docs: [Browser Automation](https://hermes-agent.nousresearch.com/docs/user-guide/features/browser)
- Official release: [Hermes Agent v0.3.0](https://github.com/NousResearch/hermes-agent/blob/main/RELEASE_v0.3.0.md)
- First-party details:
  - the product site bundles web search, page extraction, browser automation, screenshots, and vision analysis into the core feature set
  - the browser docs say Hermes can drive a local Chromium install through `agent-browser` even without cloud browser credentials
  - the v0.3.0 release adds `/browser connect` via Chrome DevTools Protocol so Hermes can attach tools to a live Chrome instance
  - Hermes also exposes browser tools through the Nous Tool Gateway for paid Nous Portal users
- Latest development checkpoint:
  - the current browser docs still present local browser mode and attached-browser mode as first-party runtime options, which means browser control remains a primary harness surface rather than a legacy experiment

## Product signal
Hermes treats browser work as a default agent capability with both local and managed execution paths, which lowers the barrier between coding, ops, and web-task automation.
