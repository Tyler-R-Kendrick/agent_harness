Feature: Owl Browser stealth automation engine
  Owl Browser differentiates by replacing fragile hosted Chromium wrappers with a self-hostable automation engine focused on anti-detection and high concurrency.

  Scenario: Create many isolated browser contexts
    Given a developer has Owl Browser running locally or in a self-hosted deployment
    When they create many contexts through the TypeScript or Python SDK
    Then each context can carry separate cookies, profile state, and fingerprint identity
    And the automation can run at high concurrency without managing a separate browser pool

  Scenario: Automate a blocked web data workflow
    Given a target site blocks ordinary headless automation
    When the workflow enables stealth, fingerprinting, proxy or Tor control, and CAPTCHA solving
    Then the browser engine attempts to complete the data extraction flow with fewer manual retries
    And output can be exported through API-facing extraction tools

  Scenario: Connect an AI assistant through MCP
    Given an AI assistant supports MCP tools
    When Owl Browser exposes its browser tools to that assistant
    Then the assistant can navigate, click, type, screenshot, and extract from the browser
    And existing Playwright scripts can be migrated incrementally rather than rewritten in one pass

  # Good: strong packaging for blocked, high-concurrency browser automation.
  # Bad: stealth-first positioning can obscure governance, approvals, and replayable user evidence.
