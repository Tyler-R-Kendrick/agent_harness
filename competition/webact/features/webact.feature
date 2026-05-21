Feature: webact token-efficient browser control
  webact differentiates by using raw CDP and compact page briefs to reduce browser-agent token cost.

  Scenario: Install one binary instead of a browser automation stack
    Given a developer wants to connect an agent to their existing Chrome
    When they install webact from the shell command or add the webact Agent Skill
    Then they get an MCP server and CLI in a single Rust binary
    And no bundled Chromium download or Playwright dependency chain is required

  Scenario: Use compact page briefs during the action loop
    Given an agent has navigated to a page
    When it calls webact actions such as navigate, click, type, scroll, search, or read
    Then webact returns a compact page brief by default
    And the agent can request fuller text or screenshots only when the task needs more context

  Scenario: Control a real Chrome session over CDP
    Given the user has Chrome with existing cookies, logins, and user agent
    When webact connects over Chrome DevTools Protocol
    Then the agent operates the user's real browser session
    And the workflow avoids the separate headless Chromium profile used by many Playwright-based tools

  # Good: compact perception directly reduces model input cost and context clutter.
  # Bad: raw CDP control and tiny UI need stronger permission, replay, and review surfaces for team use.
