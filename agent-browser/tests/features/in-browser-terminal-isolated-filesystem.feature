@agent-browser @terminal
Feature: In-browser terminal with isolated filesystem
  Terminal mode runs just-bash inside the browser and keeps shell activity inside an isolated
  in-memory filesystem for the active workspace.

  Background:
    Given the agent browser is open
    And the active workspace is "Research"

  Scenario: Switch the chat panel into Terminal mode
    When the user selects "Terminal mode" from the panel tabs
    Then the "Terminal" region is visible
    And the "Bash input" field is focused
    And the terminal output welcomes the user to "just-bash"

  Scenario: Run commands in the sandboxed shell
    Given Terminal mode is open for the active workspace
    When the user runs "pwd"
    Then the terminal output shows "/workspace"
    When the user runs "echo hello world"
    Then the terminal output shows "hello world"
    And the "Bash input" field is focused again

  Scenario: A terminal session exposes its own filesystem node
    Given the active workspace has a second terminal session named "Terminal 2"
    And Terminal mode is open for "Terminal 2"
    When the user runs "touch notes.txt"
    Then the Files category shows a "Terminal 2 FS" node
    And the terminal filesystem belongs only to the active workspace