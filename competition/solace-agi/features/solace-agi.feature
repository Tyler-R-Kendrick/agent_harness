Feature: Solace AGI governed browser recipes
  Solace AGI differentiates by turning local browser work into approved, recorded, replayable recipes.

  Scenario: Approve a browser action before execution
    Given a user starts a Solace Browser recipe for a logged-in web task
    When the agent proposes a click, form fill, or page action
    Then the browser shows what the agent sees
    And the user can approve the action before it executes
    And the user can stop the run if the plan looks unsafe

  Scenario: Replay a repeated workflow as a recipe
    Given a user has previously completed an approved browser workflow
    When they save the workflow as a recipe
    Then the recipe records steps, scopes, preconditions, and evidence outputs
    And future runs can replay the workflow with lower LLM cost
    And the run still preserves audit evidence

  Scenario: Govern an automation with permissions and budgets
    Given an organization enables Solace for team browser work
    When an agent tries to read inbox data, send messages, or use machine access
    Then Solace checks scoped permissions
    And enforces action budgets, spend budgets, and allowlists
    And fails closed when a gate is not satisfied

  # Good: approval, replay, and audit are built into the primary workflow.
  # Bad: the feature set can feel heavy when a user only wants quick browser testing.
