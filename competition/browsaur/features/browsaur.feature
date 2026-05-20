Feature: Browsaur real Chrome sessions for AI agents
  Browsaur differentiates by exposing real macOS Chrome sessions through MCP, CLI, CDP, and self-hosted deployments.

  Scenario: Connect an MCP agent to a real browser
    Given a developer installs the Browsaur CLI
    When the developer runs the built-in MCP server
    Then Claude Code, Cursor, or another MCP client receives browser_navigate, browser_click, browser_screenshot, and browser_exec tools
    And the agent controls a real Chrome session instead of a patched Linux Chromium container

  Scenario: Preserve authenticated browser profiles
    Given an automation needs a logged-in site
    When the developer creates or reuses a Browsaur profile
    Then cookies, localStorage, and auth state persist across sessions
    And the agent can reconnect through the returned CDP endpoint

  Scenario: Choose cloud or self-hosted infrastructure
    Given a team has either a Browsaur Cloud account or its own Apple Silicon Mac
    When the team provisions sessions
    Then it can use paid residential macOS Chrome hours or run the same MIT-licensed stack on its own hardware
    And existing Playwright, Puppeteer, CDP, browser-use, or MCP code can connect with minimal changes

  # Good: concrete CDP compatibility and self-hosting make migration from other browser infra simple.
  # Bad: stealth/residential positioning is strong for scraping but less focused on human-visible audit, approvals, and safe delegated browsing.
