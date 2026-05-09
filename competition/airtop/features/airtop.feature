Feature: Airtop business browser automations
  Airtop differentiates by combining cloud browser sessions, natural-language AI APIs, shared auth, and packaged automation templates.

  Scenario: Create a cloud browser session for an agent
    Given a developer has an Airtop API key
    When the developer creates a browser session
    Then Airtop provisions a cloud browser
    And the developer can drive it through AI APIs or traditional automation tools

  Scenario: Publish reusable business automations
    Given an operations user needs repeated web tasks
    When they choose or build an Airtop automation
    Then the task can run as a published agent
    And the organization can monitor usage through sessions and credits

  Scenario: Control AI operation spend
    Given an agent may require multiple model calls
    When the developer sets credit or time thresholds
    Then Airtop cancels operations that exceed configured limits
    And exposes per-request credit usage for monitoring

  # Good: shared auth, live view, and templates reduce time to useful business automation.
  # Bad: agent/template abstraction can obscure deterministic replay, failure proof, and true cost.
