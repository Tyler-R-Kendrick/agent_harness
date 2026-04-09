---
project: BrowserOS
type: chromium-fork
status: active
last_reviewed: 2026-04-04
---

# BrowserOS

## Overview
Open-source Chromium hard fork with native Model Context Protocol (MCP) integration. Provides 31+ built-in tools for AI agents. Local-first execution with support for Ollama or API keys. Kimi K2.5 as default model. Key innovation: MCP protocol embedded directly in browser architecture.

## Technical Approach
- **Base**: Chromium hard fork
- **AI Integration**: Native MCP support with 31+ tools; Kimi K2.5 default; Ollama or API key endpoints
- **Key Differentiator**: MCP protocol as first-class browser primitive; open-source; tool ecosystem embedded in browser

## Key Learnings
- MCP protocol is valuable abstraction layer for browser-agent interaction
- 31+ tools suggest rich ecosystem potential for agentic workflows
- Open-source fork model allows community contribution but requires governance
- Default model choice (Kimi K2.5) signals emerging model diversity

## UX Innovations
- Native MCP tool discovery and invocation
- Local-first execution preserves user data
- Flexible model selection (Ollama/API)
- Embedded tool ecosystem reduces external dependencies

## Risks & Concerns
- Hard fork maintenance burden increases over time with Chromium updates
- Reliance on Kimi K2.5 creates vendor risk
- Unclear how governance model will scale with community contributions
- Security implications of native tool execution need careful review

## Links
- BrowserOS GitHub repository
- MCP specification documentation

## Notes
BrowserOS represents attempt to make MCP a browser-native protocol rather than external integration point. Open-source fork model is sustainable if community engagement grows. 31+ embedded tools suggest rich design space for agentic browsing. Hard fork maintenance is long-term cost center.
