Feature: Browserless managed browser automation
  Browserless differentiates by combining a remote browser fleet, a stealth-first BrowserQL language, and production debugging artifacts.

  Scenario: Run a stealth BrowserQL workflow
    Given a developer has a Browserless API token
    When they submit a BrowserQL mutation that navigates, clicks, types, and extracts text
    Then Browserless runs the workflow in a managed browser
    And the response includes structured outputs from the page
    And stealth, CAPTCHA, proxy, and fingerprint controls can be applied at the platform layer

  Scenario: Move an existing Playwright script to BaaS
    Given a team has local Playwright automation
    When they replace the local browser launch with a Browserless WebSocket endpoint
    Then the script runs against a managed remote browser
    And the team can use persisted sessions, launch parameters, and regional endpoints without managing browser hosts

  Scenario: Debug a failed automation with replay evidence
    Given a BrowserQL workflow fails on a dynamic site
    When replay or recording is enabled for the session
    Then the operator can inspect visual changes, user interactions, console logs, and network activity in the Browserless dashboard
    And the failure can be triaged without rerunning the exact browser path immediately

  # Good: production browser reliability and replay artifacts are strong differentiators for teams beyond local prototypes.
  # Bad: agent workflows inherit Browserless cost, network, anti-bot, and platform-state complexity.
