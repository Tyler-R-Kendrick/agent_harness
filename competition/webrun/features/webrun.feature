Feature: WebRun cloud desktop automation
  WebRun differentiates by giving agents a fast persistent browser-plus-desktop environment with live observability and policy controls.

  Scenario: Execute a browser task through MCP
    Given a developer has a WebRun API key
    When they configure the WebRun MCP endpoint in an AI agent
    And the agent sends a natural-language browser task
    Then WebRun starts a real browser session
    And returns structured task output plus session visibility

  Scenario: Enforce a destructive-action policy
    Given a team has a policy blocking clicks on delete-related controls
    When an agent attempts to click a matching element
    Then WebRun pauses or blocks the action
    And the operator can reject or approve the guarded action

  Scenario: Reuse a persistent environment
    Given a workflow needs cookies, files, and preferences across runs
    When the agent targets an existing environment
    Then browser state, file storage, memory, skills, and schedules are reused
    And the task can continue without reauthenticating every run

  # Good: fast, observable, policy-aware infrastructure.
  # Bad: broad desktop surface and usage pricing require strong governance and cost visibility.
