Feature: Warpsurf local Chrome AI browser copilot
  Warpsurf differentiates by running an open-source, model-agnostic browser copilot locally in Chrome with visible control, cost, and multi-agent workflow surfaces.

  Scenario: Route a request to chat, search, or browser agent
    Given a user enters a browser task in the side panel
    When Warpsurf's smart router classifies the request
    Then it chooses chat, web-augmented search, or autonomous browser-agent workflow
    And the user does not have to manually pick an execution mode first

  Scenario: Run a local autonomous browser workflow
    Given the user has configured supported model API keys
    When the user deploys an autonomous agent
    Then the agent navigates and interacts with webpages in Chrome
    And the user can monitor actions in real time

  Scenario: Control a running agent
    Given an agent is mid-task
    When the task reaches a critical point or appears wrong
    Then the user can pause, resume with new instructions, send a live follow-up, take control, or emergency stop all workflows

  Scenario: Bound authority and cost before execution
    Given a user wants to avoid unsafe sites and runaway model spend
    When the user configures URL firewall rules and reviews task estimates
    Then Warpsurf constrains allowed domains
    And previews expected steps, duration, and cost before starting

  # Good: local browser, visible controls, and cost surfaces are unusually aligned with user trust.
  # Bad: research-stage automation still requires supervision and careful key scoping.
