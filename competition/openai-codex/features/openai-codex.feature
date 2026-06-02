Feature: OpenAI Codex multi-agent coding workflow
  OpenAI Codex differentiates by turning coding agents into supervised tasks across desktop, cloud, CLI, IDE, and GitHub review surfaces.

  Scenario: Delegate parallel coding tasks from a command center
    Given a developer has several scoped implementation tasks
    When they start separate Codex agent threads for each task
    Then each agent works in an isolated context
    And the developer can switch between tasks without losing the review state
    And the developer can inspect each task's diff before accepting work

  Scenario: Review and revise an agent change
    Given Codex has produced a code change
    When the developer opens the thread diff
    And comments on a hunk or asks for a revision
    Then Codex incorporates the feedback in the same task context
    And the developer can open the change in their editor for manual edits

  Scenario: Govern local and cloud coding authority
    Given an organization has enabled Codex workspace controls
    When an admin configures Codex Local and Codex Cloud permissions
    Then members can be restricted to approved execution surfaces
    And delegated cloud tasks can be separated from local app workflows

  Scenario: Manage long-running task cost
    Given a Codex task uses substantial reasoning and output tokens
    When the user reviews the usage page or limit banner
    Then they can see remaining usage or credit options for their plan
    And decide whether to continue, upgrade, add credits, or wait for reset

  # Good: parallel task supervision and diff review match how agentic coding is actually used.
  # Bad: browser evidence, permission traces, and cost predictability can still be less visible than the code diff.
