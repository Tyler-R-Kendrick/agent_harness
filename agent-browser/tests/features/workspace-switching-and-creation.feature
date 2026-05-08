@agent-browser @workspaces
Feature: Project switching and creation
  Research and Build are project entries backed by workspaces, and users can switch, create, and rename
  projects without losing project-scoped state.

  Background:
    Given the agent browser is open
    And the projects "Research" and "Build" both exist

  Scenario: Open the project switcher and swap the active project
    When the user opens the project switcher from the project pill toggle
    Then the "Project switcher" dialog is visible
    When the user selects the "Build" project
    Then the project pill shows "Build"
    And the workspace tree updates to the "Build" root

  Scenario: Create and rename a new project
    When the user presses "Ctrl+Alt+N"
    Then a new project named "Project 3" becomes active
    When the user renames the active project to "Ops"
    Then the project pill shows "Ops"

  Scenario: Preserve page overlays per workspace while switching
    Given the "Research" workspace has the "Hugging Face" tab open as a page overlay
    When the user switches to the "Build" workspace
    Then the "Research" page overlay is not visible
    When the user opens the "CopilotKit docs" tab in "Build"
    And the user switches back to the "Research" workspace
    Then the "Hugging Face" page overlay is restored
