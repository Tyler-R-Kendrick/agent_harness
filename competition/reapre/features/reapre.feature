Feature: Reapre multi-surface automation control plane
  Reapre differentiates by making browser control one layer inside a governed AI automation platform.

  Background:
    Given a team has a Reapre API key
    And the team has connected browser, computer, mobile, or app targets

  Scenario: Control a browser through MCP or WebSocket
    Given an AI agent is connected to Reapre through MCP
    When the agent asks for a login page to be opened
    And the agent asks Reapre to find the submit button by natural language
    And the agent requests a screenshot after the action
    Then Reapre should execute browser commands through the shared command surface
    And Reapre should preserve screenshots, logs, and run metadata for review

  Scenario: Promote a repeated browser task into an governed workflow
    Given an operator has a successful command sequence
    When the operator saves the sequence as a reusable template
    And schedules the template with retries and webhook delivery
    Then Reapre should run the automation without rebuilding the command sequence
    And downstream systems should receive signed run events

  Scenario: Extend a browser workflow into desktop and app connectors
    Given a browser flow downloads a spreadsheet
    When the agent needs to update Excel and send an Outlook message
    Then Reapre can route those steps through app connectors or computer control
    And the run remains visible in the same dashboard

  # Differentiation:
  # - Good: strong for operations teams that need repeatable automation, not just ad hoc page control.
  # - Bad: breadth may hide browser-specific evidence unless recordings, screenshots, DOM snapshots, and policy decisions are first-class in every run view.
