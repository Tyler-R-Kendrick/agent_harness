Feature: Kernel serverless browsers for agents
  Kernel differentiates by offering CDP-compatible cloud browsers, live debugging, standby cost controls, and a direct agent-browser provider path.

  Scenario: Run agent-browser on a Kernel cloud session
    Given a user has a Kernel API key
    And the agent-browser provider is set to Kernel
    When the user opens a URL through agent-browser
    Then agent-browser connects to a Kernel cloud browser
    And browser commands work through the remote session

  Scenario: Persist authenticated browser state
    Given a workflow needs cookies and login state across runs
    When the user configures a Kernel profile name
    Then Kernel creates or reuses the profile
    And saves session data back to the profile when the browser ends

  Scenario: Inspect and replay a failed session
    Given a cloud browser task fails
    When the developer opens live view, logs, or replay artifacts
    Then they can inspect what happened in the browser
    And adjust automation code, profile, stealth, or pool configuration

  # Good: CDP compatibility plus direct agent-browser docs create a credible cloud backend story.
  # Bad: Kernel is infrastructure, so user-facing workflow design and proof still fall to the buyer.
