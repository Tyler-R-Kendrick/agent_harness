# Puppeteer Marketing

## Audience

- JavaScript developers automating Chrome or Firefox.
- QA and scraping teams that want browser control without buying a hosted platform.
- Agent framework builders who need a reliable browser substrate under an MCP or tool-calling surface.

## Positioning

Puppeteer positions itself as a high-level API for real browser control. It is not marketed as an AI agent, but it competes with agent-browser products because many buyers ask whether a thin Puppeteer wrapper is enough.

The current documentation also acknowledges the MCP direction by pointing to a Puppeteer-based Chrome DevTools MCP server and experimental WebMCP.

## Customer Model

- Open-source npm adoption.
- Ecosystem pull from Chrome, DevTools Protocol, WebDriver BiDi, and examples.
- No direct SaaS monetization; value accrues to hosted browser platforms, QA tools, and agent products built on top.

## Who It Captures

- Developers who want deterministic scripts and source-level control.
- Teams with existing test/scraping infrastructure.
- Agent builders who want to own their browser runtime rather than depend on a higher-level product.

## Who It Does Not Capture

- Operators who want a product workflow instead of code.
- Enterprises that need built-in audit logs, approvals, policy, and replay surfaces.
- Agent users who want visible recovery controls, cost transparency, and durable evidence after each run.

## Competitive Takeaway

Puppeteer is the "build it yourself" pressure on `agent-browser`. The answer cannot be only browser control; it has to be better trace UX, safer authority boundaries, and agent-ready evidence around the browser primitive.
