Feature: Magnitude vision-first browser automation
  Magnitude differentiates by wrapping browser actions, extraction, and tests in a vision-first developer API.

  Scenario: Run browser actions from natural language
    Given a developer starts a Magnitude BrowserAgent
    When they call act with a task such as "log in to the app"
    Then Magnitude plans browser interactions from the current visual state
    And it can click, type, drag, press keys, switch tabs, or navigate

  Scenario: Extract structured page data
    Given the browser is on a data-rich page
    When the developer calls extract with instructions and a Zod schema
    Then Magnitude uses the page screenshot, simplified DOM content, and schema
    And it returns structured data that can feed normal control flow

  Scenario: Keep deterministic browser control available
    Given a developer needs lower-level browser control
    When they configure Playwright launch options, browser context options, or CDP
    Then the agent can run against a tailored browser session
    And the developer can access the underlying Playwright page and context

  # Good: combines human-like visual grounding with typed extraction and Playwright escape hatches.
  # Bad: vision calls add latency and need strong replay/debug surfaces when actions misfire.
