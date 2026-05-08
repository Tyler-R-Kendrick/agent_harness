Feature: Hyperbrowser cloud browser and agent infrastructure
  Hyperbrowser differentiates by exposing scalable browser sessions, scraping APIs, hosted agent runtimes, and Playwright-compatible AI automation.

  Scenario: Launch a managed browser session
    Given a developer has a Hyperbrowser API key
    When the developer creates a cloud browser session
    Then Hyperbrowser returns a session that can be controlled through SDKs or CDP
    And the developer can connect with Playwright, Puppeteer, or Selenium

  Scenario: Run an AI browser agent
    Given a developer has a browser automation task
    When the developer starts a Browser Use, HyperAgent, Claude, OpenAI, or Gemini agent run
    Then Hyperbrowser executes the task in a managed cloud browser
    And the developer can poll for status or use SDK helpers that wait for completion

  Scenario: Mix deterministic Playwright with AI actions
    Given a workflow has stable steps and ambiguous steps
    When the developer uses HyperAgent
    Then deterministic steps can remain normal Playwright code
    And ambiguous interactions can use AI commands such as perform, extract, or executeTask

  Scenario: Debug and price a production run
    Given a run consumed browser time, proxy traffic, pages, and agent steps
    When the developer reviews billing and recordings
    Then they can connect cost to the exact execution path
    And decide whether to replace AI steps with deterministic code

  # Good: flexible provider/runtime surface and Playwright fallback support production adoption.
  # Bad: many overlapping modes can confuse implementation choices and cost forecasting.
