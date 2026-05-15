Feature: Replit Agent prompt-to-app workspace
  Replit Agent differentiates by turning plain-language ideas into running apps with planning, background tasks, design Canvas, and deployment in one browser workspace.

  Scenario: Build an app from a natural-language prompt
    Given a user opens a Replit project
    When the user describes an app in Agent chat
    Then Agent creates a plan
    And writes code, configures infrastructure, tests the result, and shows a preview

  Scenario: Run parallel background tasks
    Given Agent has proposed several implementation tasks
    When the user accepts the task plan
    Then tasks run in isolated copies of the project
    And the user can review logs, test results, and previews before applying changes

  Scenario: Explore visual directions on Canvas
    Given a user wants to compare product screens
    When the user asks Agent for several design variants
    Then Canvas displays the variants as frames
    And the user can annotate, resize, preview by device, and apply the chosen direction

  # Good: complete builder loop from idea to deployed app.
  # Bad: agent cost and implementation quality can be hard to predict.
