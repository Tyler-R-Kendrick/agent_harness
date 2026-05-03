# API And ACP Session Control

- Harness: Devin
- Sourced: 2026-05-02

## What it is
Devin exposes programmable session control through its API and Agent Client Protocol work, which makes the harness more embeddable than a browser-only product surface.

## Evidence
- Official docs: [API Reference](https://docs.devin.ai/api-reference/overview)
- Official docs: [API Key Setup](https://docs.devin.ai/product-guides/api/api-key)
- Official release notes: [Devin Release Notes 2026](https://docs.devin.ai/release-notes/2026)
- Official engineering post: [Introducing ACP](https://github.com/cognitionai/agent-client-protocol)
- First-party details:
  - the docs expose session-oriented API primitives rather than only account management endpoints
  - the January 22, 2026 release added session origin controls and send-message API support, which reinforces the idea that sessions are meant to be driven programmatically
  - Devin's ACP work signals that the company wants external clients and tools to integrate against a stable agent protocol surface
- Latest development checkpoint:
  - the current API and ACP materials position Devin as a harness that other products and workflows can embed or orchestrate

## Product signal
The winning harnesses are increasingly exposing a runtime contract, not just a UI, so other surfaces can launch, monitor, and steer agent work directly.
