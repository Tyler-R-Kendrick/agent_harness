Feature: Vector AI Agent local plain-English browser automation
  Vector AI Agent differentiates by packaging multi-profile browser automation for nontechnical Windows users.

  Background:
    Given Vector AI Agent is installed on Windows
    And the user has connected Chrome or Edge browser profiles

  Scenario: Automate a browser task in natural language
    Given a nontechnical user wants to repeat a web task
    When the user types a plain-English command
    Then Vector should interpret the task
    And control the real browser without requiring Selenium, Playwright, Puppeteer, or an extension script

  Scenario: Run many isolated profiles
    Given an operator manages many accounts
    When they ask Vector to create or operate many browser profiles
    Then Vector should launch isolated Chrome or Edge profiles
    And execute parallel operations locally

  Scenario: Choose a model provider for automation
    Given the user has preferred AI models
    When they configure OpenAI, Anthropic, Gemini, Ollama, DeepSeek, OpenRouter, or another provider
    Then Vector should route browser tasks through the selected provider
    And avoid locking the user into a single model vendor

  # Differentiation:
  # - Good: clear no-code local automation wedge for account-heavy operators.
  # - Bad: high-scale profile and wallet automation increases trust, abuse, and account-ban risk.
