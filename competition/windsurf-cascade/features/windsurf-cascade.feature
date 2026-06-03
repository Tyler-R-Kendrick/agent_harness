Feature: Windsurf Cascade agentic IDE workflow
  Windsurf Cascade differentiates by embedding code-agent execution,
  memory, recovery, and cloud delegation inside a familiar editor.

  Background:
    Given a developer has opened a project in Windsurf
    And Cascade has access to editor selection, terminal context, project files, and configured rules

  Scenario: Use Cascade Code for a multi-file implementation
    When the developer opens Cascade with Cmd or Ctrl plus L
    And the developer asks Cascade to implement a feature
    Then Cascade should build or refine a todo list for the task
    And Cascade should call tools such as Search, Analyze, Web Search, MCP, and terminal as needed
    And Cascade should modify project files in Code mode
    And Cascade should offer progress through the conversation timeline

  Scenario: Recover from an agent change with checkpoints
    Given Cascade has changed files during a conversation
    When the developer chooses a named checkpoint or original prompt revert
    Then Windsurf should return code changes to that earlier state
    And the user should understand that the revert operation is irreversible

  Scenario: Customize behavior through memories, rules, and AGENTS.md
    When Cascade learns a reusable project fact
    Then it may create a local Memory
    But durable shared behavior should be written as a Rule or AGENTS.md file
    And enterprise teams should be able to enforce system-level rules

  Scenario: Deploy a web app from Cascade
    Given the project is a supported JS web app
    When the developer asks Cascade to deploy it
    Then App Deploys should upload the code to Windsurf's server
    And publish a preview URL through the supported provider
    And write or reuse windsurf_deployment.yaml for future redeploys

  Scenario: Continue local work while handing off a task to Devin
    Given the developer has a complex debugging, testing, or deployment task
    When the developer hands off from Cascade to Devin
    Then Devin should work in its own cloud machine
    And the developer should keep coding locally in Windsurf
    And the editor should remain the coordination surface for local and cloud agent work

  # Differentiation:
  # - Good: tight editor awareness, checkpoints, rules/memories, deploy previews, and cloud delegation from one IDE.
  # - Bad: pricing complexity, model quota anxiety, simultaneous-edit races, and Cascade reliability complaints can interrupt flow.
