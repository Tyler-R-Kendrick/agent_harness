Feature: Notte full-stack browser agent platform
  Notte differentiates by combining browser sessions, perception actions, agents, functions, credentials, identities, and studio tools in one platform.

  Scenario: Control a cloud browser session through actions
    Given a developer has a Notte API key
    When the developer opens a session
    And calls observe to inspect available actions
    And calls execute to perform an action
    Then the automation can navigate, click, fill, or scrape through a structured action layer

  Scenario: Run an autonomous web agent
    Given a Notte session is active
    When the developer creates an agent with a reasoning model and max step limit
    And asks it to complete a browser task
    Then the agent observes the page, reasons about the next action, executes it, and iterates until success, error, or step limit

  Scenario: Convert successful agent work into a function
    Given an agent has discovered a reliable workflow
    When the developer converts the run into a reusable function
    Then the workflow can be invoked as an API endpoint
    And future runs can avoid expensive improvisation where deterministic code is sufficient

  Scenario: Use credentials without exposing them to the LLM
    Given a workflow needs access to a logged-in third-party service
    When the developer stores credentials in a Notte vault or attaches an identity/profile
    Then the session can authenticate safely
    And secrets are not forwarded to model calls

  # Good: strong path from exploratory agent to reusable function plus first-class auth primitives.
  # Bad: integrated platform adoption can feel heavy for teams wanting only a local browser agent.
