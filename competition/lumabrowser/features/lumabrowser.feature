Feature: LumaBrowser programmable browser with native MCP and selector fallback
  LumaBrowser differentiates by combining local browser protocols with resilient selector resolution.

  Background:
    Given LumaBrowser is running locally
    And the REST API is available on port 3000

  Scenario: Drive the browser through REST
    Given a developer wants to automate a dynamic website
    When they create a tab with the REST API
    And click an element with a CSS selector and an `llmFallback` description
    And fetch the page source as clean text
    Then LumaBrowser should navigate, interact, and extract through the local browser
    And the selector fallback should recover when the original selector is stale

  Scenario: Connect an MCP agent without glue code
    Given Claude Desktop or another MCP-compatible agent is configured with LumaBrowser
    When the agent asks to navigate, click, fill forms, or read the DOM
    Then LumaBrowser should expose those browser tools through its built-in MCP server
    And the agent should not need a custom wrapper around Playwright or Selenium

  Scenario: Reuse existing automation libraries
    Given a QA engineer already uses Selenium, Puppeteer, or Playwright
    When they connect to LumaBrowser through WebDriver or CDP
    Then they can keep their preferred client library
    And receive the same LLM selector-fallback behavior

  # Differentiation:
  # - Good: pragmatic bridge for developers who want browser protocols plus AI recovery.
  # - Bad: selector recovery needs transparent logs or it can become another opaque self-healing layer.
