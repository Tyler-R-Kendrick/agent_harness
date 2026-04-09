# Browser Research: Steering Summary
> Last updated: 2026-04-04

## Executive Summary
The 2024-2026 period marks a fundamental shift from incremental browser innovation to existential reimagining. Three major trends: AI-native browsers (Atlas, Comet, Dia), agentic frameworks (Browser Use, Stagehand), and privacy-first alternatives (BrowserOS, SigmaOS). Chromium is the universal base. The real innovation is in the integration layer, not the engine.

## Key Strategic Insights

### 1. Chromium Is the Only Viable Base (For Now)
Every successful agentic browser is Chromium-based. Servo and Ladybird are 2+ years from production. Building on anything else is a non-starter today.

### 2. The Integration Layer Is Where Value Lives
The browser engine itself is table stakes. The differentiators are: how AI is integrated (sidebar vs native), what context the AI gets (single tab vs multi-tab vs full session), and how agentic actions are controlled (manual activation vs autonomous).

### 3. Security Is the Achilles Heel
Comet's March 2026 crash from #3 App Store to "Not Ranked" proves that agentic credential handling and security hardening must come before mass deployment. Brave's isolated-profile approach is the right model.

### 4. Local-First vs Cloud Is a Real Split
Three camps: cloud-only (Atlas, Comet), hybrid (Brave, Beam), local-first (BrowserOS, SigmaOS). Enterprise customers strongly prefer local-first for data residency.

### 5. MCP Is Emerging as the Agent-Browser Protocol
BrowserOS embedding MCP directly into the browser is architecturally interesting. Playwright MCP's accessibility-tree approach is complementary. MCP may become the standard interface between AI agents and browsers.

### 6. Simplicity Wins for Consumers
Arc's death and Dia's birth prove that power-user complexity doesn't scale. The winning UX is simple defaults with progressive disclosure.

### 7. Counter-Positioning Is Viable
Vivaldi's "Keep Browsing Human" stance shows there's a real market for anti-AI browsers. Not everyone wants agents.

## Architecture Decision: How to Build Our Fork

### Recommended Approach
1. **Base**: Start from Ungoogled-Chromium or content_shell (depending on feature needs)
2. **Build system**: Patch-based workflow (not git branch), daily/weekly rebase
3. **AI integration**: Native MCP server embedded in browser (BrowserOS pattern) + sidebar WebUI panel
4. **Context model**: Multi-tab awareness with explicit user consent
5. **Security**: Isolated agent profile (Brave pattern), manual activation default
6. **Build optimization**: ccache + component builds for dev, ThinLTO + strip for release
7. **Target**: 45-90 min full build, 5-15 min incremental

### Build Quick Reference
- Disk: 500GB+, RAM: 32GB recommended
- Tools: depot_tools, GN, Ninja, ccache
- Key GN args: is_component_build=true (dev), symbol_level=0, enable_nacl=false, use_thin_lto=true
- First build: `fetch chromium` → `gn gen out/Default` → `autoninja -C out/Default chrome`

## What to Watch
- [ ] Ladybird Alpha (Summer 2026) — first real non-Chromium alternative
- [ ] BrowserOS MCP integration maturity
- [ ] Comet recovery or death after security crisis
- [ ] Chrome's Gemini 3 Auto Browse adoption (incumbent advantage)
- [ ] Servo embedding API maturity for lightweight use cases

## Competitive Landscape (April 2026)

| Browser | AI Approach | Open Source | Status | Our Take |
|---------|-------------|-------------|--------|----------|
| Atlas (OpenAI) | ChatGPT-native | No | Active | Strongest consumer play |
| Comet (Perplexity) | Search-AI-native | No | Damaged | Security cautionary tale |
| Dia (Atlassian) | Productivity-AI | No | Active | Enterprise distribution advantage |
| BrowserOS | MCP-native, local-first | Yes | Growing | Most architecturally interesting |
| SigmaOS | Local-first, free | Partial | Active | Privacy+free is compelling |
| Brave | Privacy+AI hybrid | Yes | Experimental | Best security model |
| Edge | Copilot integration | No | Active | Enterprise default |
| Chrome | Gemini integration | No | Active | Incumbent advantage |

## Fork/Build Tracking

See subfolders:
- `forks/` — AI-native and agentic browser projects
- `frameworks/` — Browser automation and agent frameworks
- `alternatives/` — Chromium performance forks and alternative engines
- `build-guide/` — Technical guides for building and customizing Chromium
