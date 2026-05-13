Feature: Nanobrowser extension-based browser agents
  Nanobrowser differentiates by running open-source browser agents inside the user's existing browser.

  Scenario: Run an automation from the extension panel
    Given a user has installed the Nanobrowser extension
    And configured an AI provider
    When the user enters a browser task in the extension panel
    Then Nanobrowser operates the current browser context
    And reports the agent's steps back in the panel

  Scenario: Use logged-in browser context
    Given the user is already signed in to a website
    When Nanobrowser needs to interact with that site
    Then it can use the existing tab and browser profile
    And avoids a separate cloud login or remote profile setup

  Scenario: Inspect and modify open-source behavior
    Given a developer wants to understand the agent implementation
    When they inspect the GitHub repository
    Then they can review extension permissions, agent orchestration, and model integrations
    And adapt the project for their own workflows

  # Good: existing-browser install path and open-source transparency.
  # Bad: extension permissions plus BYOK setup create adoption and trust friction.
