Feature: Simular computer-use agent platform
  Simular differentiates by automating browser, desktop, and smartphone workflows through a transparent, modifiable execution layer.

  Scenario: Automate a desktop task
    Given a user has Simular installed on macOS or available through the web app
    When the user describes a computer task
    Then Simular operates across the desktop environment
    And the user can inspect what actions the agent is taking

  Scenario: Convert intent into repeatable Simulang
    Given a developer wants reliable production automation
    When they describe or craft a workflow
    Then Simular represents the execution in Simulang
    And the workflow can be read, edited, and reused instead of remaining a black-box trace

  Scenario: Integrate automation into a production pipeline
    Given a team has an existing backend workflow
    When it calls Simular through a webhook
    Then Simular executes the computer-use task
    And returns results into the team's pipeline

  # Good: transparent DSL and cross-platform scope.
  # Bad: whole-computer automation requires stronger safety, permissions, and rollback than browser-only agents.
