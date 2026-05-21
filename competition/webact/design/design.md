# webact Design

## Look And Feel

- webact uses a compact developer landing page with a terminal-first hero, benchmark table, simple perceive-act loop, and architecture comparison.
- The page is intentionally sparse: single binary, zero dependencies, raw CDP, actual Chrome, and minimal tokens.
- The design centers numbers and contrasts: 5.4 MB binary, 60+ commands, 98%/91%/96% output reductions, and Playwright install overhead.
- The visual system is functional rather than polished; it feels closer to a README-backed tool than a SaaS product.

## Design Tokens Observed

```yaml
visual_language:
  mode: minimal command-line tool
  surfaces: install command, metric counters, token comparison rows, architecture diagram
  information_density: medium
  brand_voice: terse, technical, comparative
interaction_patterns:
  primary_actions:
    - install shell command
    - view on GitHub
    - add agent skill
  product_loop:
    - act
    - perceive compact brief
    - decide next step
```

## Differentiators

- The design makes token savings the product. It compares directly against Playwright-based tools, including agent-browser.
- "Single binary, zero dependencies" is a strong setup contrast against tools that download bundled Chromium or require Node stacks.
- The perceive-act loop is clear: each action returns a small page brief, and the agent asks for larger reads only when needed.
- Supporting an Agent Skill as well as MCP broadens adoption across Claude Code, Cursor, Codex, Windsurf, Cline, Copilot, OpenCode, and Goose.

## Where It Breaks Down

- Minimal UI means limited help for non-developers or teams that need visible approvals and review artifacts.
- Raw CDP control is powerful but low-level; users must trust the agent and the tool to avoid over-broad browser authority.
- The token comparison is compelling, but the page does not show the same depth of behavioral reliability evidence as its output-size evidence.
- A one-command installer is convenient but may need extra enterprise security explanation.

## Sources

- https://webact.space/
- https://github.com/kilospark/webact
