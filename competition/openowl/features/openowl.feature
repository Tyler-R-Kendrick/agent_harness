Feature: OpenOwl local desktop automation
  OpenOwl differentiates by giving MCP-compatible AI assistants local screen, mouse, keyboard, app, and browser control.

  Scenario: Connect a local AI assistant
    Given a user installs OpenOwl with npm
    And their assistant supports MCP
    When they add a project or target surface
    Then the assistant can see the screen and use OpenOwl tools to click, type, and navigate
    And the work can run on the user's existing computer

  Scenario: Automate a multi-app workflow
    Given a task spans a browser tab, spreadsheet, mail client, or desktop app
    When the user describes the desired work in plain language
    Then OpenOwl lets the assistant operate across those surfaces
    And returns a summary when the task is complete

  Scenario: Keep sensitive screen data local
    Given the user self-hosts OpenOwl
    When the assistant requests screen, file, or keystroke context
    Then the local server processes the automation on the user's machine
    And the user can audit the Apache-licensed source code

  # Good: whole-desktop and local privacy are strong adoption wedges.
  # Bad: pixel/screen automation can be fragile without accessibility-tree refs and careful approval design.
