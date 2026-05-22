# Tandem Browser Design

## Look And Feel

- Tandem uses an opinionated open-source product page with a dense, manifesto-like narrative rather than a lightweight app-store pitch.
- The visual story centers on "symbiosis": human and AI sharing one browser, one tab set, cookies, DOM, accessibility tree, network log, and DevTools.
- The page is text-heavy but structured with comparison sections, stats, security claims, FAQ, and sponsorship cards.
- Product proof is mainly architectural and conceptual; the page emphasizes protocol depth, MCP tool count, HTTP endpoints, and security layers more than polished screenshots.

## Design Tokens Observed

```yaml
visual_language:
  mode: open_source_infrastructure_browser
  tone: technical_manifesto
  density: high
  trust_markers:
    - MIT license
    - no cloud backend
    - no telemetry
    - signed macOS builds
    - Windows support disclosed as unsigned
interaction_patterns:
  primary_actions:
    - view GitHub
    - read docs
    - get started
  proof_units:
    - MCP tool count
    - HTTP endpoint count
    - security layer count
    - GitHub stars
```

## Differentiators

- The strongest design choice is making the human-in-the-loop relationship first class. The site repeatedly explains that the agent can pause, ask for help, and resume after a human click or instruction.
- Local-first privacy is presented as a product architecture, not just a privacy badge: no backend, no telemetry, private Tailscale access, and same-session browser state.
- The comparison against WebMCP is useful because it positions Tandem as the browser layer for sites that will not expose their own agent tools.
- The security story is unusually explicit for this category, with named filtering layers, prompt-injection handling, and automated test counts.

## Where It Breaks Down

- The page can feel over-explained. Buyers looking for a fast install path or simple visual proof may struggle to find "what does the app look like while I use it?"
- The "AI rides alongside a real logged-in browser" message is powerful but increases the need for visible approval, scope, and session boundaries.
- Unsigned Windows builds are disclosed honestly, but SmartScreen warnings are still a conversion and trust problem.
- The "257 MCP tools" claim can be impressive to developers and overwhelming to users who want a small, auditable permission surface.

## Sources

- https://tandembrowser.org/
- https://tandembrowser.org/changelog
