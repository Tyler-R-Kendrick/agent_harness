Feature: Remote computer-use instances for agents
  Scrapybara differentiates by hosting whole desktop and browser instances for computer-use agents.

  Scenario: Start a browser instance for an agent
    Given a developer has a Scrapybara API key
    When the developer starts a BrowserInstance
    Then Scrapybara returns a lightweight Chromium environment
    And the developer can use CDP, screenshots, streams, auth state, and computer actions

  Scenario: Run a model loop with tools
    Given a developer wants a computer-use agent to complete a web task
    And has selected a model and Scrapybara tools
    When the developer calls the Act SDK with a prompt
    Then the SDK loops through model messages, tool calls, and tool results
    And returns final messages, steps, text, output, and usage

  Scenario: Resume authenticated work
    Given a browser workflow requires a logged-in website
    When the agent saves an auth state
    And starts a later instance using that auth state
    Then the task can continue without repeating the login flow

  # Good: whole-computer scope supports broader automation than browser-only tools.
  # Bad: cloud desktop cost, vendor continuity, and generic instance APIs can weaken product trust.
