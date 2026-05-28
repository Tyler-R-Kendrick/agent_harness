Feature: Orbit Cloud agentic browser runtime
  Orbit Cloud differentiates by letting teams develop browser automations locally and deploy the same runtime to managed cloud operation.

  Scenario: Develop locally and deploy to cloud
    Given a builder has validated a browser automation in Orbit's desktop app
    When they deploy the same automation to Orbit Cloud
    Then it runs with runtime parity across CDP, Playwright, or Selenium
    And the team can operate it with schedules, webhooks, and cloud browser capacity

  Scenario: Operate an authenticated browser workflow
    Given a production workflow requires persistent auth, cookies, or 2FA
    When the team configures Orbit Cloud session helpers and state management
    Then the browser run can preserve required auth state
    And scoped tokens and policy controls limit operational access

  Scenario: Debug a failed cloud run
    Given an automation fails against a flaky website
    When an operator opens the run artifacts
    Then they can inspect structured logs, traces, screenshots, and audit history
    And tune retries, backoff, concurrency, or guardrails before the next run

  # Good: runtime parity and enterprise observability are strong.
  # Bad: sales-led packaging may be too heavy for local-first browser users.
