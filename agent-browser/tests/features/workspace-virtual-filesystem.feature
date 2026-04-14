@agent-browser @workspace-files @virtual-filesystem
Feature: Virtual filesystem per workspace
  Each workspace has its own Files surface that merges persisted capability files with terminal
  session filesystem nodes.

  Background:
    Given the agent browser is open
    And the active workspace is "Research"

  Scenario: Add capability files to the active workspace
    When the user adds an "AGENTS.md" file from the workspace tree
    Then the file editor opens with the path "AGENTS.md"
    When the user adds a skill named "review-pr"
    Then the active workspace file editor shows ".agents/skill/review-pr/SKILL.md"

  Scenario: Merge terminal filesystem nodes into Files
    Given the active workspace has a second terminal session named "Terminal 2"
    When the user creates "notes.txt" from "Terminal 2"
    Then the Files category includes a "Terminal 2 FS" node
    And the Files surface still includes persisted workspace capability files

  Scenario: Swap the Files surface when switching workspaces
    Given "Research" has capability files attached to it
    And "Build" is a separate workspace
    When the user switches from "Research" to "Build"
    Then the workspace tree shows the "Build" root and its Files category
    And the Files surface no longer shows the "Research" capability files