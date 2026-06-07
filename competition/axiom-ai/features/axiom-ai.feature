Feature: Axiom.ai no-code browser bot
  Axiom.ai differentiates by turning browser scraping and data-entry jobs into visual bots that can run locally or in the cloud.

  Scenario: Build a browser scraping bot without code
    Given an operator has installed the Axiom.ai Chrome extension
    When they add steps to open a page, select data, loop over rows, and export results
    Then Axiom.ai stores the browser workflow as a reusable bot
    And the operator can rerun it without writing Playwright or API code

  Scenario: Schedule an automation with app integrations
    Given a team wants browser work to update another business system
    When they add Google Sheets, webhook, Zapier, or Make steps
    Then the bot can pass data into and out of the browser workflow
    And higher paid tiers can trigger scheduled or cloud runs

  Scenario: Control run location and runtime spend
    Given a bot can run on the desktop or in the cloud
    When the user chooses a run method and watches monthly runtime
    Then local runs use the user's own machine
    And cloud runs consume plan runtime and respect cloud duration limits

  # Good: no-code steps and integrations make repetitive browser work accessible to operators.
  # Bad: long-running browser loops still need robust recovery, state inspection, and evidence when Chrome or the target site drifts.
