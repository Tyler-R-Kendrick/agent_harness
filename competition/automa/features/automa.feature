Feature: Automa block-based browser workflows
  Automa differentiates through an open-source extension builder with a broad block catalog for local browser automation.

  Scenario: Build a workflow from connected blocks
    Given a user wants to automate a repetitive browser task
    When they add trigger, browser, web interaction, and control-flow blocks
    Then Automa executes the workflow inside the browser extension
    And can fill forms, click elements, scrape data, or take screenshots

  Scenario: Add logic and data handling to a browser task
    Given a workflow needs to process extracted page data
    When the user adds variables, tables, loops, conditions, and data mapping blocks
    Then the workflow can branch, repeat, transform, and export information

  Scenario: Escape to code for advanced automation
    Given the visual blocks cannot express a specific interaction
    When the user adds JavaScript or expression-based logic
    Then the workflow can call lower-level browser/page capabilities
    And advanced users can bridge gaps without leaving the extension model

  # Good: broad block primitives make the runtime inspectable and adaptable.
  # Bad: selector, iframe, browser-version, and login issues leak quickly into user experience.
