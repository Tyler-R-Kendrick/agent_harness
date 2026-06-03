Feature: Factory Droids multi-surface coding delegation
  Factory Droids differentiates by treating software work as a delegated agent mission
  that can move across CLI, IDE, cloud computers, browser, Slack, and PR review.

  Background:
    Given a developer has installed Droid CLI
    And the project has repository instructions, tests, and optional MCP servers configured

  Scenario: Delegate a coding task from local CLI to pull request
    When the developer asks Droid to implement a natural-language task
    Then Droid should inspect the repository context
    And Droid should propose or execute a plan according to the configured autonomy level
    And Droid should edit files inside the allowed project scope
    And Droid should run commands or tests with permission controls
    And Droid should prepare reviewable changes for a pull request

  Scenario: Use Missions for a larger project
    When the developer starts "/missions"
    Then Droid should ask clarifying questions before implementation
    And Droid should break the work into features and milestones
    And Droid should enter Mission Control after plan approval
    And Mission Control should track progress through the approved plan
    And the developer should be able to re-scope milestones during execution

  Scenario: Move a Droid into managed or bring-your-own compute
    Given a task needs long-running execution or a preconfigured environment
    When the developer assigns the task to a Droid Computer
    Then Factory should run the Droid in a managed or user-provided machine
    And the developer should be able to monitor progress remotely
    And the execution should preserve the same policy, model, and integration controls

  Scenario: Capture browser or software-operation evidence
    Given the task requires operating external software
    When Droid Control launches apps, clicks buttons, types commands, or records output
    Then the run should produce inspectable action evidence
    And the developer should be able to use that evidence during review

  Scenario: Recover from a usage limit during an autonomous task
    Given the organization has rolling usage windows
    When a Droid hits a limit mid-session or mid-Mission
    Then Factory should pause or refuse subsequent requests rather than silently overrun budget
    And the developer should be able to inspect limits with "/limits"
    And the developer should be able to choose Droid Core or prepaid Extra Usage if enabled

  # Differentiation:
  # - Good: multi-surface delegation, long-task orchestration, cloud/local compute choice, enterprise governance, and PR-oriented output.
  # - Bad: quota windows, model-dependent loops, UI lag, and broad surface area can erode confidence during real work.
