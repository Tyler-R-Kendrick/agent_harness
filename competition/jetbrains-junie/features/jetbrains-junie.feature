Feature: JetBrains Junie IDE and CLI coding-agent workflow
  JetBrains Junie differentiates by combining IDE-native project intelligence
  with a standalone CLI, model choice, MCP tools, and review/debug modes.

  Background:
    Given a developer has a JetBrains AI subscription, BYOK model, or Junie CLI authentication
    And the project has a configured project path and optional guidelines

  Scenario: Run Junie inside a JetBrains IDE
    When the developer opens Junie from AI Chat
    And asks Junie to complete a multi-step coding task
    Then Junie should plan and execute actions across the project
    And Junie should run tests or terminal commands when needed
    And Junie should report progress while it works
    And Junie should request confirmation for edits outside the configured project path

  Scenario: Configure project-specific authority and context
    When the developer sets Junie project settings
    Then Junie should respect the configured project path
    And Junie should ignore files or folders listed in .aiignore
    And Junie should use AGENTS.md or guidelines.md according to the configured guidelines path
    And semantic indexing should help find relevant project context when enabled

  Scenario: Use Junie CLI plan mode before implementation
    When the developer runs Junie CLI in plan mode for a requested feature
    Then Junie should analyze the codebase with read-only operations
    And Junie should produce a design document before writing code
    And the developer should be able to review the plan before execution

  Scenario: Add tools through MCP Installation Assistant
    When the developer runs the Junie CLI "/mcp" command
    Then Junie should list configured MCP servers and statuses
    And the MCP Installation Assistant should help add servers from a registry or from scratch
    And Junie should verify server startup when possible

  Scenario: Review local changes through Junie CLI
    Given the project is a git repository
    When the developer runs "/review"
    Then Junie should offer review targets such as current branch against main, last commit, or unstaged changes
    And Junie should report findings that the developer can accept or dismiss
    And the local feedback should align with JetBrains automated PR review behavior

  # Differentiation:
  # - Good: IDE-aware project context, plan/debug/review modes, MCP assistant, ACP, and clear edit-scope settings.
  # - Bad: credit consumption, subscription complexity, WSL limitation, and weak browser-session evidence leave room for browser-first tools.
