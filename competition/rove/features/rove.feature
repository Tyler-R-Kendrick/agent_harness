Feature: Rove hosted Playwright API for agents
  Rove differentiates by selling token-aware hosted browser sessions with MCP integration and recorded evidence.

  Scenario: Start a hosted browser session
    Given a developer wants browser automation without operating browser infrastructure
    When they call the Rove session API
    Then Rove allocates a warm Playwright-powered browser context
    And the developer can navigate, click, fill, wait, screenshot, and close the session through an API

  Scenario: Use accessibility trees instead of screenshot loops
    Given an AI agent needs page context
    When it requests an accessibility tree
    Then Rove returns structured page information intended for an LLM
    And the workflow can spend fewer tokens than repeated screenshot-to-vision calls

  Scenario: Debug an agent run after completion
    Given an agent session completed or failed
    When the developer requests the session artifact
    Then Rove provides a recorded `.webm` video by signed URL
    And the artifact remains available for the advertised retention window

  # Good: token-aware perception and recorded artifacts are concrete developer value.
  # Bad: hosted sessions still need explicit trust, retention, and credential-isolation controls.
