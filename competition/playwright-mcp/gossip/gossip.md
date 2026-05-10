# Playwright MCP Gossip

## Positive Signals

- The official Playwright repository now presents Playwright MCP as a first-class path for AI agents and LLM-driven automation.
- Public docs and Microsoft Learn examples show practical usage in complex apps where selectors are app-specific, nested, or slow to appear.
- GitHub adoption signals are strong because the project inherits Playwright's brand and has visible issue and fork activity.

## Negative Signals

- A public Playwright issue reports that accessibility snapshots can include off-screen elements, causing agents to generate invalid tests for UI that a real user cannot currently reach.
- A security discussion flagged indirect prompt injection through malicious accessibility-tree text, a risk for any agent that feeds page text into model context.
- Historical issues include browser-profile lock errors, browser version mismatches, extension connection trouble, HTTP transport session deletion, shared-context surprises, and tab-closing confusion.

## Bug And UX Risk Themes

- Accessibility trees are optimized for assistive technology, not necessarily for viewport-bounded agent action.
- MCP tool calls can be verbose and context-heavy compared with purpose-built CLI scripts or product-specific browser commands.
- Authentication and existing-browser workflows are hard to make universal across local, SSH, devcontainer, and extension setups.

## Sources

- https://playwright.dev/mcp/introduction
- https://github.com/microsoft/playwright
- https://github.com/microsoft/playwright-mcp
- https://learn.microsoft.com/en-us/power-platform/developer/playwright-samples/ai-mcp
- https://github.com/microsoft/playwright-mcp/issues
- https://github.com/microsoft/playwright/issues/39955
- https://github.com/microsoft/playwright-mcp/issues/1479
