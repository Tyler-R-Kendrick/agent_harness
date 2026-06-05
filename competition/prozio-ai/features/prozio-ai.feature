Feature: Prozio AI no-code browser agents
  Prozio AI differentiates by combining no-code workflow nodes with real-browser agent actions, saved profiles, BYOK, and webhook integrations.

  Scenario: Create a webhook-triggered browser agent
    Given a user wants an API-callable browser automation
    When they create a Prozio automation with a webhook trigger
    And add a Prozio Agent node
    Then the agent can navigate, click, type, scroll, and extract data in a browser environment
    And the workflow can return a structured response to the caller

  Scenario: Reuse authenticated browser context safely
    Given a task requires a logged-in website
    When the user selects a saved browser profile
    And provides sensitive fields through Prozio's protected input mechanism
    Then the agent can use the session and required values
    And the raw sensitive values should not be exposed to the model as plain prompt text

  Scenario: Debug and iterate before production
    Given a user is building a multi-node automation
    When they run the workflow in test mode
    Then each node returns execution output
    And later nodes can reference prior node responses through variables
    And the user can refine the workflow before scheduling or calling it from production

  # Good: concrete node model, BYOK, profiles, test mode, and webhooks.
  # Bad: saved profiles and sensitive fields raise the need for stronger audit, approvals, and replay UX.
