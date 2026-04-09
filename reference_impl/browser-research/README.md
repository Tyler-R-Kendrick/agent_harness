# Browser Research Repository

Research and tracking for building a next-generation agentic browser experience.

## Structure

### `build-guide/`
Technical documentation for building, forking, and customizing Chromium.
- `chromium-build-and-fork-guide.md` — Complete guide: source checkout, build process, architecture, customization points, forking strategy, branding, distribution
- `minimal-chromium-build-strategies.md` — Minimal builds, CEF, Electron vs fork, content_shell, build optimization, lightweight forks comparison

### `forks/` — Agentic Browser Projects
Individual tracking documents for browsers reimagining the experience with AI.

| Project | Type | Status | Key Innovation |
|---------|------|--------|---------------|
| [Atlas](forks/atlas/) | AI-native browser | Active | ChatGPT as first-class citizen |
| [Comet](forks/comet/) | AI-native browser | Damaged | Multi-site agentic workflows |
| [Dia](forks/dia/) | AI-native browser | Active | Simplicity over complexity |
| [SigmaOS](forks/sigmaos/) | AI-native browser | Active | Free, local-first agents |
| [Brave](forks/brave/) | Privacy+AI hybrid | Experimental | Privacy-first agentic model |
| [Opera](forks/opera/) | AI-enhanced browser | Active | 100M+ mobile reach |
| [Vivaldi](forks/vivaldi/) | Anti-AI browser | Active | Counter-positioning |
| [Beam](forks/beam/) | iPad-first browser | Active | Tablet-native agentic UX |
| [BrowserOS](forks/browseros/) | Open-source agentic | Active | Native MCP integration |
| [Edge](forks/edge/) | Enterprise AI browser | Active | Copilot/Agent Mode |
| [Chrome AI](forks/chrome-ai/) | Incumbent AI browser | Active | Gemini Auto Browse |

### `frameworks/` — Browser Automation Frameworks
Tools that layer AI automation on top of existing browsers.

| Framework | Stars | Key Approach |
|-----------|-------|-------------|
| [Browser Use](frameworks/browser-use/) | 78K+ | De facto standard |
| [Playwright MCP](frameworks/playwright-mcp/) | — | Accessibility tree |
| [Stagehand](frameworks/stagehand/) | 50K+ | Multi-language SDK |
| [Skyvern](frameworks/skyvern/) | — | Vision-based |
| [AgentQL](frameworks/agentql/) | — | Query language |
| [Browserbase](frameworks/browserbase/) | — | Cloud infrastructure |

### `alternatives/` — Chromium Forks & Alternative Engines
Performance forks and non-Chromium engines worth monitoring.

| Project | Focus | Status |
|---------|-------|--------|
| [Thorium](alternatives/thorium/) | Performance (8-38% faster) | Active |
| [Ungoogled-Chromium](alternatives/ungoogled-chromium/) | Privacy (de-Googled) | Very Active |
| [Cromite](alternatives/cromite/) | Ad blocking + privacy | Active |
| [Carbonyl](alternatives/carbonyl/) | Terminal browser | Active |
| [Servo](alternatives/servo/) | Rust engine (library) | Early |
| [Ladybird](alternatives/ladybird/) | Independent engine | Pre-alpha |

## Key Documents
- **[STEERING-SUMMARY.md](STEERING-SUMMARY.md)** — Strategic insights and architecture decisions
- **[build-guide/](build-guide/)** — How to actually build a Chromium fork

## Last Updated
2026-04-04
