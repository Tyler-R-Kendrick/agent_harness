# Browser Providers And Live Studio Control

- Harness: Mastra
- Sourced: 2026-05-01

## What it is
Mastra now lets agents browse the web through pluggable browser providers while streaming each interaction through Studio so operators can watch, intervene, or stop the run live.

## Evidence
- Official announcement: [Announcing Browser Support for Mastra Agents](https://mastra.ai/blog/announcing-browser-support)
- First-party details:
  - Mastra says attaching a browser gives agents tools to navigate pages, click through flows, fill forms, and extract structured data.
  - The announcement says browser activity is integrated into Studio, where every interaction is streamed live and the human can step in or stop the agent at any point.
  - The first supported providers are Stagehand and AgentBrowser, with support for both local browsers and managed services like Browserbase.
  - The official announcement includes an embedded demo video and a browser-session screenshot rather than just static API docs.
- Latest development checkpoint:
  - browser support was announced on April 24, 2026 as a new capability requiring `@mastra/core@1.22.0` or later

## Product signal
Mastra is turning browser use into a provider-backed runtime primitive with built-in supervision, not a bolt-on script. That is the same direction high-agency harnesses are moving when they stop being pure chat products and start acting on websites directly.
