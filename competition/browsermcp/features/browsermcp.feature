Feature: Local real-browser control through MCP
  BrowserMCP differentiates by giving AI clients access to the user's existing Chrome profile.

  Scenario: Automate a logged-in website from an AI client
    Given a developer has installed the BrowserMCP server
    And has connected the Chrome extension
    When the developer asks an MCP-compatible assistant to navigate and click in Chrome
    Then the assistant can operate the existing browser profile
    And the task can use the user's current cookies and logged-in accounts

  Scenario: Keep browser activity local
    Given a user is concerned about cloud browser data routing
    When they run BrowserMCP locally
    Then browser activity is controlled through a local server and extension
    And the user avoids sending the live browser session to a remote browser platform

  Scenario: Debug extension and tab state
    Given the MCP server has been restarted or killed
    When the extension still appears connected
    Then the user must determine whether actions are reaching the intended server instance
    And missing connection-state clarity can make browser failures hard to diagnose

  # Good: local profile access, privacy, and low-friction MCP compatibility are strong.
  # Bad: extension/server state, tab persistence, and looping failures can erode trust.
