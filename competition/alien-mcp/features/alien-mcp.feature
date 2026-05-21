Feature: AlienMcp real Chrome tab control
  AlienMcp differentiates by combining a local MCP bridge with Chrome tab-group scoping.

  Scenario: Scope browser authority to a tab group
    Given a user has installed the AlienMcp Chrome extension
    And the user has added selected tabs to the AlienMcp group
    When an MCP client asks for browser context
    Then AlienMcp exposes only the tabs in that group
    And the user's other Chrome tabs remain outside the agent-visible scope

  Scenario: Drive logged-in Chrome with trusted events
    Given a user is logged into a web app in Chrome
    When Claude Code, Cursor, or another MCP client calls AlienMcp tools
    Then the agent can navigate, find elements, click, type, hover, scroll, read DOM, inspect network and console events, and work with cookies or storage
    And interactions are sent through Chrome DevTools Protocol rather than a detached headless browser

  Scenario: Keep browser automation local
    Given a developer starts the Node MCP server on localhost
    When the Chrome extension connects over WebSocket
    Then commands stay between the MCP client, local server, extension, and browser
    And no external hosted browser service is required

  # Good: visible tab-group scoping gives users a simple control boundary.
  # Bad: local setup and high-authority CDP tools still need strong user education and audit trails.
