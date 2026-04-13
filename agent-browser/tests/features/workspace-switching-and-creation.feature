@agent-browser @workspaces
Feature: Workspace switching and creation
  Research and Build are separate workspaces, and users can switch, create, and rename workspaces
  without losing workspace-scoped state.

  Background:
    Given the agent browser is open
    And the workspaces "Research" and "Build" both exist

  Scenario: Open the workspace switcher and swap the active workspace
    When the user opens the workspace switcher from the workspace pill toggle
    Then the "Workspace switcher" dialog is visible
    When the user selects the "Build" workspace
    Then the workspace pill shows "Build"
    And the workspace tree updates to the "Build" root

  Scenario: Create and rename a new workspace
    When the user presses "Ctrl+Alt+N"
    Then a new workspace named "Workspace 3" becomes active
    When the user renames the active workspace to "Ops"
    Then the workspace pill shows "Ops"

  Scenario: Preserve page overlays per workspace while switching
    Given the "Research" workspace has the "Hugging Face" tab open as a page overlay
    When the user switches to the "Build" workspace
    Then the "Research" page overlay is not visible
    When the user opens the "CopilotKit docs" tab in "Build"
    And the user switches back to the "Research" workspace
    Then the "Hugging Face" page overlay is restored