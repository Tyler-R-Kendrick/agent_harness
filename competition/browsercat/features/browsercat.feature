Feature: BrowserCat hosted browser automation
  BrowserCat differentiates by making Playwright-compatible browser fleet capacity cheap, global, and easy to adopt.

  Scenario: Connect Playwright to a remote browser
    Given a developer has a BrowserCat API key
    When they replace a local browser launch with the BrowserCat websocket endpoint
    Then BrowserCat launches an isolated remote browser session
    And the developer can navigate, click, fill, run JavaScript, capture screenshots, export PDFs, and close the session through familiar Playwright APIs

  Scenario: Scale browser jobs without fleet operations
    Given a team needs many browser tasks for scraping, tests, or AI-agent browsing
    When they run parallel jobs against BrowserCat
    Then the jobs use a globally distributed browser fleet
    And the team avoids maintaining local Chromium installs, containers, and browser hosts

  Scenario: Control usage spend
    Given browser sessions can run for unpredictable durations
    When usage crosses account soft and hard limits
    Then BrowserCat can notify the user and reject requests at the hard limit
    And the buyer can reason about websocket time and utility API requests as credits

  # Good: familiar protocol compatibility and visible cost controls lower adoption friction.
  # Bad: hosted browser capacity does not by itself solve agent evidence, approvals, or sensitive-session trust.
