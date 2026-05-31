Feature: Midscene vision-driven UI automation
  Midscene differentiates by exposing pure-vision UI actions across browsers, mobile, desktop, and MCP clients.

  Scenario: Automate a browser flow with PlaywrightAgent
    Given a developer has a Playwright page
    When they wrap it in a Midscene PlaywrightAgent
    Then they can issue natural-language UI actions
    And they can combine those actions with normal Playwright flow control

  Scenario: Debug a model-driven action run
    Given a Midscene automation has run across multiple UI states
    When the developer opens the replay report
    Then they can inspect screenshots and step-by-step actions
    And they can decide whether the visual agent clicked the intended target

  Scenario: Expose UI automation through MCP
    Given an upper-layer coding or agent client supports MCP
    When Midscene MCP services expose atomic Midscene Agent actions
    Then the higher-level agent can inspect and operate UIs with natural language
    And the automation can span browser, mobile, desktop, or canvas-style interfaces

  # Good: broad platform support and replay tooling make vision automation easier to adopt.
  # Bad: QA teams still worry about latency, flakiness, and loss of deterministic locator control.
