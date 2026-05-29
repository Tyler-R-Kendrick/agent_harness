Feature: Containerized desktop agent takeover
  Bytebot differentiates by giving the agent a complete virtual computer instead of a browser-only runtime.

  Background:
    Given a team has deployed Bytebot with an LLM key
    And the Bytebot desktop, agent, chat UI, and database services are running

  Scenario: User delegates a multi-application desktop task
    When the user enters a natural-language task in the Bytebot task UI
    Then Bytebot plans and executes the task in a visible virtual desktop
    And the agent can use the browser, file system, office tools, terminal, and installed applications
    And the task history records conversation context and desktop evidence

  Scenario: User recovers a stuck workflow
    Given the agent reaches a page, app, or credential flow it cannot complete alone
    When the user opens the desktop view
    Then the user can take over the virtual desktop
    And the user can hand control back to the agent after resolving the blocker

  Scenario: Developer connects programmatically
    When a developer calls the task API, desktop API, or MCP SSE endpoint
    Then Bytebot exposes the same desktop automation surface outside the web UI
    And the integration can reuse the virtual desktop for browser and non-browser workflows

  # Good implementation: recovery, evidence, and a broad app surface are visible concepts.
  # Bad implementation: the authority boundary is broad and requires stronger approvals than a tab-scoped browser agent.
