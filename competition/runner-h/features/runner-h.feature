Feature: Runner H and Surfer H web-agent workflows
  H Company differentiates by combining business-agent orchestration with specialized VLM web agents and a Studio for production web automation.

  Scenario: Create a Studio web automation from natural language
    Given a developer has a brittle web workflow such as checkout testing or onboarding form completion
    When the developer describes the workflow in Runner H Studio
    Then Runner H designs a web automation pipeline
    And the Studio lets the developer review and edit past or live runs

  Scenario: Run a managed cloud web agent through an API
    Given a team has a Runner H private beta API key
    When it calls a managed agent with a browser task
    Then the cloud agent plans, sees, clicks, and repeats until the task completes or needs correction

  Scenario: Dispatch Surfer H from a broader workflow
    Given a user asks Runner H to produce a finished deliverable
    And the workflow requires live web data
    When Runner H assigns specialist agents
    Then it can dispatch Surfer H to collect browser evidence
    And return finished work such as a filled spreadsheet, formatted document, or booked calendar event

  Scenario: Run Surfer-H locally or from the terminal
    Given a developer has H Company API credentials
    When the developer launches the Surfer-H CLI or frontend
    Then the agent can operate a browser through Holo-powered visual action models
    And the developer can configure speed, cost, and accuracy tradeoffs

  # Good: specialized VLMs and run-review Studio attack the root brittleness of web automation.
  # Bad: beta maturity and product naming create adoption friction.
