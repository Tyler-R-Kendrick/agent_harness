Feature: Google Antigravity agent-first development workflow
  Google Antigravity differentiates by making autonomous agents operate across editor, terminal, and browser while reporting back through reviewable artifacts.

  Scenario: Delegate a frontend implementation to an agent
    Given a developer has a repository open in Antigravity
    When they ask an agent to build a frontend feature
    Then the agent writes code in the editor
    And runs terminal commands to start or test the app
    And uses the browser to verify behavior
    And returns artifacts such as plans, screenshots, recordings, or diffs

  Scenario: Supervise multiple agents from an agent manager
    Given a developer has several independent tasks
    When they launch concurrent agent sessions
    Then each task is tracked separately
    And the developer can review plans, progress, and artifacts before accepting work

  Scenario: Review visual proof of a UI change
    Given an agent has modified a user-facing workflow
    When it finishes verification
    Then it should attach browser evidence such as screenshots or recordings
    And the developer can judge whether the UI behavior matches the request

  Scenario: Restrict risky autonomous actions
    Given an agent needs terminal and filesystem access
    When a risky command or broad file operation is requested
    Then the product should apply permission boundaries or secure-mode controls
    And the user should retain enough trace detail to audit what happened

  # Good: native browser verification and artifact review are directly relevant to frontend trust.
  # Bad: broad autonomous authority and rate-limit churn make permission clarity and raw trace auditability critical.
