Feature: MultiOn web-agent sessions
  MultiOn differentiates by exposing autonomous web actions as developer-friendly sessions with automatic and stepwise control.

  Scenario: Browse a website automatically
    Given a developer has a MultiOn API key
    When the developer calls browse with a URL and command
    Then MultiOn creates an agent session
    And the agent steps through the website until the task is done or user input is required

  Scenario: Step through a recoverable session
    Given a developer has created a session
    When the agent returns ASK_USER
    Then the developer can provide additional command context
    And the same session continues instead of restarting the whole workflow

  Scenario: Run in local browser mode
    Given the user has installed the MultiOn Chrome extension
    When the developer creates a session with local mode enabled
    Then the server-hosted agent interacts with the user's browser
    And authenticated browser state can be used for the task

  # Good: clear API shape around browser sessions, screenshots, status, proxy, and local mode.
  # Bad: the product still inherits browser brittleness, extension dependence, and session-expiry orchestration needs.
