Feature: UiPath governed agentic automation
  UiPath differentiates by orchestrating agents, robots, people, APIs, documents, and legacy UIs under enterprise controls.

  Scenario: Orchestrate a long-running enterprise process
    Given an automation center of excellence owns a multi-system business process
    And the process includes legacy UI work, API work, documents, and human judgment
    When the team models the process in UiPath Maestro
    Then AI agents, robots, and people are coordinated from one control plane
    And governance and audit artifacts are preserved for enterprise review

  Scenario: Use Autopilot to complete employee work
    Given an employee needs to complete a daily task across business apps
    When they describe the task to UiPath Autopilot
    Then Autopilot can recommend or run an available automation
    And the resulting workflow can be exported for reuse in Studio Web

  Scenario: Recover from a changed UI
    Given a robot depends on a changing business application screen
    When the application UI changes
    Then UiPath Healing Agent attempts to adapt the automation
    And the automation owner can reduce break/fix maintenance work

  # Good: strong governance and enterprise orchestration.
  # Bad: broad suite complexity and cost can be a poor fit for local-first browser work.
