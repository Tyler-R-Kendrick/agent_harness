Feature: TaskMagic browser recording
  TaskMagic differentiates through local browser recording, editable steps, AI-assisted step generation, and apps integration.

  Scenario: Record a browser workflow from the desktop app
    Given a user has installed the TaskMagic desktop app and browser extension
    When they start recording an automation
    Then TaskMagic opens a connected Chrome session
    And captures clicks, typing, navigation, and scraping actions as editable steps

  Scenario: Repair or generate steps with the AI Agent
    Given a recorded workflow has a missing or brittle step
    When the user enables the AI Agent and describes the desired action
    Then TaskMagic suggests or inserts the step
    And the user can keep mixing prompt assistance with manual recording

  Scenario: Combine browser automation with app workflow pieces
    Given a browser automation needs data from a sheet, webhook, or other app step
    When the user adds Apps pieces in the builder
    Then the browser task can be triggered, parameterized, or continued by app workflow logic
    And the user can run the automation headed or headless

  # Good: recording plus AI repair gives non-technical users a concrete path to automation.
  # Bad: reliability still depends on page timing, selectors, local profile state, and desktop/cloud runtime boundaries.
