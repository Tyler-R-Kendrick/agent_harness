Feature: Microsoft Edge Copilot Mode
  Microsoft Edge Copilot Mode differentiates through incumbent distribution, Copilot new tab, cross-tab/history context, voice browsing, Actions, and Journeys.

  Scenario: Keep Copilot beside browsing
    Given a user has Copilot Mode enabled in Edge
    When the user opens a link from Copilot or asks about a page
    Then Copilot stays available in a side pane
    And the user can continue viewing the original page

  Scenario: Summarize tabs and browsing history
    Given a user has granted the required permissions
    When the user asks Copilot to compare or resume prior browsing
    Then Copilot can use open tabs and browsing history
    And it returns more relevant summaries or next steps

  Scenario: Run a Copilot Action
    Given a user asks Edge to perform a routine web task
    When Copilot detects an action request
    Then Copilot clicks, scrolls, types, and navigates in an open or background tab
    And the user can inspect the tab where Copilot is working

  Scenario: Avoid sensitive tasks
    Given a task involves banking, IDs, medical records, or confidential data
    When the user asks Copilot Actions to perform the task
    Then Microsoft guidance says the user should not use Actions for that workflow
    And the product should keep the user in direct control

  # Good: distribution and ecosystem integration are hard to beat.
  # Bad: Copilot-heavy UI, AI nudges, and sidebar changes can alienate users who liked Edge's non-AI productivity tools.
