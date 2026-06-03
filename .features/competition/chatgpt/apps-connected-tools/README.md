# Apps And Connected Tools

- Harness: ChatGPT
- Sourced: 2026-06-03

## What it is
ChatGPT apps are a unified external-tool layer that can provide in-chat UI, synced knowledge retrieval, deep-research sources, and upgraded write actions inside the same conversation surface.

## Evidence
- Help article: [Apps in ChatGPT](https://help.openai.com/en/articles/11487775-apps-in-chatgpt)
- Help article: [ChatGPT apps with sync](https://help.openai.com/en/articles/10847137-chatgpt-apps-with-sync)
- Release notes: [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes)
- Business release notes: [ChatGPT Business - Release Notes](https://help.openai.com/en/articles/11391654-chatgpt-business-release-notes)
- Capabilities called out:
  - in-chat actions
  - file/data search
  - deep research across connected sources
  - synced content for faster answers
  - app upgrades that preserve sync while adding new actions
  - `@` mentions and tool-menu targeting
  - permission-respecting retrieval scoped to what the current user can already access
  - proactive suggestions based on connected information
- Official lifecycle details:
  - connectors were renamed to apps on 2025-12-17
  - some sync-enabled apps can be upgraded into action-capable app variants
  - synced data can feed Memory when Memory is enabled
  - updated Box, Notion, Linear, and Dropbox apps add newer action surfaces, including write capabilities where supported
  - Google and Microsoft app write actions are gated behind admin review and remain disabled by default until enabled per app
  - Business admins can now choose `all actions`, `read actions only`, or a custom action set, and can separately decide how newly added actions are handled later
  - ChatGPT now treats app-action governance as an explicit workspace policy surface rather than a hidden side effect of connecting an app

## Product signal
OpenAI is treating connected tools as a native action-and-context substrate, with a clear progression from passive sync to live MCP-like actions inside the main ChatGPT runtime.
