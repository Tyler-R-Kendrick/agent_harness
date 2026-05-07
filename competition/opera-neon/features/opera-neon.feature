Feature: Opera Neon agentic AI browser
  Opera Neon differentiates by packaging agentic browsing into Chat, Do, Make, Tasks, and Cards.

  Scenario: Execute a browser task with Neon Do
    Given a user is logged into websites in Opera Neon
    When the user activates Neon Do within a Task
    Then Neon can open tabs, close tabs, navigate, gather page data, and fill forms
    And the user can pause or take over while the task runs

  Scenario: Reuse a Card for repeatable prompting
    Given a user has a recurring AI workflow
    When the user selects a custom or community Card
    Then Neon applies pre-defined instructions to the prompt
    And the user avoids re-explaining the workflow from scratch

  Scenario: Make a lightweight web app from intent
    Given a user describes something they want to create
    When the user uses Neon Make
    Then cloud-hosted agents can continue creating the output
    And the work can continue even when the user goes offline

  # Good: memorable modes and reusable Cards make agentic behavior productized.
  # Bad: too many modes can feel confusing, and early hands-on reports describe slow or mistaken behavior.
