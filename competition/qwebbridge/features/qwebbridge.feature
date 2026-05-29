Feature: Local Chrome bridge for AI agents
  QWebBridge differentiates by pairing a local daemon, browser extension, and agent skill around a real user browser.

  Background:
    Given QWebBridge is installed on the user's machine
    And the Chrome extension is connected to the daemon on localhost

  Scenario: Agent controls a real logged-in tab
    When an MCP-compatible agent sends a browser command
    Then the QWebBridge daemon forwards the command to the Chrome extension
    And the extension uses Chrome DevTools Protocol to act in the user's real browser
    And the response returns page state or screenshots to the agent

  Scenario: User installs agent-specific guidance
    When the user runs the skill installation command
    Then the agent receives usage guidance for tools, sessions, screenshots, and troubleshooting
    And future tool calls can follow the bridge's expected workflow

  Scenario: Developer chooses an integration protocol
    When a developer connects over WebSocket, MCP, or HTTP
    Then the same local browser bridge can serve different AI clients
    And the browser data remains on the local machine by default

  # Good implementation: architecture, privacy, and protocol choices are explicit.
  # Bad implementation: setup has several moving pieces and real-tab authority needs narrow scoping.
