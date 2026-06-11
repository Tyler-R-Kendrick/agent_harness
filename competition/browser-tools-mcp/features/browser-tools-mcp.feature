Feature: BrowserTools MCP browser debugging evidence
  BrowserTools MCP differentiates by giving MCP coding agents access to local browser debugging artifacts.

  Scenario: Connect an MCP client to a live Chrome tab
    Given a developer has installed the BrowserTools Chrome extension
    And the local browser-tools server is running
    And the MCP server is configured in an MCP-compatible IDE
    When the developer opens the BrowserTools panel in Chrome DevTools
    Then the agent can request browser logs and screenshots from the active tab
    And the developer can keep debugging without leaving the IDE

  Scenario: Run a packaged browser audit
    Given a page is loaded in the active browser tab
    When the agent invokes Audit Mode
    Then BrowserTools MCP runs accessibility, performance, SEO, and best-practice checks
    And returns structured audit results the agent can use to propose fixes

  Scenario: Debug a frontend failure with page evidence
    Given a page has console errors or failing network requests
    When the agent asks for logs and network activity
    Then BrowserTools MCP returns the captured artifacts
    And the agent can correlate code changes with the observed browser failure

  # Good: turns browser debugging artifacts into MCP-readable evidence.
  # Bad: multi-process setup and inactive-maintenance signal create reliability risk.
