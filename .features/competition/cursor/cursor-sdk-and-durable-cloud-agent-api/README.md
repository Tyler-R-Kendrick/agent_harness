# Cursor SDK And Durable Cloud Agent API

- Harness: Cursor
- Sourced: 2026-05-01

## What it is
Cursor now exposes its own harness as a TypeScript SDK and upgraded cloud-agent API so teams can launch, stream, resume, and manage durable agents programmatically instead of only through the editor UI.

## Evidence
- Official changelog: [Build programmatic agents with the Cursor SDK](https://cursor.com/changelog/sdk-release)
- Official blog: [Build programmatic agents with the Cursor SDK](https://cursor.com/blog/typescript-sdk)
- First-party details:
  - Cursor says the SDK exposes the same runtime, harness, and models used by the desktop app, CLI, and web app
  - the release explicitly supports local, Cursor-cloud, and self-hosted execution through one programming surface
  - the updated Cloud Agents API is now run-scoped, with SSE streaming, reconnect support, archive and delete lifecycle controls, and standardized agent-versus-run response shapes
  - Cursor's blog positions this as infrastructure for CI, automations, internal platforms, and customer-facing product embeddings rather than only a developer convenience
- Latest development checkpoint:
  - the public-beta SDK launched on April 29, 2026, making Cursor one of the clearest examples of a coding harness becoming a reusable agent platform

## Product signal
Cursor is no longer only competing as an editor with an AI assistant. It is also competing as a programmable agent runtime that other products and automation systems can embed directly.
