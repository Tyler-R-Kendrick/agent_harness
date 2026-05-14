@agent-browser @workspaces @render-panes @visual @session-dashboard-default
Feature: Dashboard default render pane after closing sessions
  The workspace dashboard is the default render pane. When users close session panes,
  the dashboard should remain available instead of leaving the main pane empty.

  Background:
    Given the agent browser is open
    And the active workspace is "Research"

  Scenario: Close the active chat session and return to the dashboard
    Given the "Session 1" session render pane is open
    When the user closes the active chat session panel
    Then the dashboard is the visible default render pane
    And the empty render pane placeholder is hidden
    And the dashboard render pane visual evidence is captured as "agent-browser-dashboard-after-session-close.png"

  Scenario: Close every visible chat session and return to the dashboard
    Given the active workspace has two visible chat session render panes
    When the user closes every visible chat session panel
    Then the dashboard is the visible default render pane
    And the empty render pane placeholder is hidden
    And the dashboard render pane visual evidence is captured as "agent-browser-dashboard-after-all-sessions-close.png"
