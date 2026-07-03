Feature: Chromeflow guided real-Chrome work
  Chromeflow differentiates by letting Claude Code or Codex drive the user's existing Chrome session for setup and SaaS workflows.

  Scenario: Install the coding-agent browser bridge
    Given a developer uses Claude Code or Codex
    When they install the Chromeflow plugin and Chrome extension
    Then the agent gains MCP browser tools
    And the browser remains the user's visible Chrome session

  Scenario: Complete a SaaS setup workflow
    Given a developer asks the agent to set up a third-party service for a project
    When the agent opens the SaaS dashboard in Chrome
    Then it can create resources, read generated IDs, and update local project configuration
    And it pauses for 2FA, password, payment, or other human-owned steps

  Scenario: Recover from browser-extension connection instability
    Given multiple agent sessions or a reconnecting extension
    When the MCP side cannot immediately reach the browser extension
    Then Chromeflow polls for a grace period
    And reconnects the extension faster
    And avoids failing the first tool call solely because the extension was in backoff

  # Good: maps directly to real setup work that browser farms do not handle naturally.
  # Bad: extension/native-host reliability becomes part of every user workflow.
