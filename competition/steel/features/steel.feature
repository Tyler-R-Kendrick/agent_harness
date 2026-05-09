Feature: Steel browser API for AI agents
  Steel differentiates by packaging an open-source browser API with cloud sessions and agent-framework integrations.

  Scenario: Start a reusable browser session
    Given a developer has Steel Cloud or a self-hosted Steel container
    When the developer creates a session
    Then Steel returns a session identifier and browser connection details
    And the developer can connect with Playwright, Puppeteer, Selenium, or an SDK

  Scenario: Give an agent cleaned web context
    Given an LLM workflow needs page content
    When the developer calls Steel quick actions for scrape, screenshot, or PDF
    Then the workflow receives a format optimized for model consumption
    And the browser can still execute JavaScript for dynamic pages

  Scenario: Debug a browser automation failure
    Given an automation fails against a real site
    When the developer opens the session viewer or logs
    Then they can inspect the browser state and request behavior
    And adjust proxy, cookies, extension, CAPTCHA, or automation logic

  # Good: OSS, CDP compatibility, and cloud/self-host choice reduce adoption risk.
  # Bad: reliability and performance issues are especially visible because the product sits under every agent step.
