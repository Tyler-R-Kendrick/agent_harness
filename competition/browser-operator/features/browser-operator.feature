Feature: Browser Operator local AI browser workflows
  Browser Operator differentiates by packaging web research and automation inside an open-source Chromium browser.

  Scenario: Start an AI browser conversation
    Given a user has installed Browser Operator on macOS or Windows
    And the user has configured an AI provider
    When the user asks the browser assistant to search for current prices
    Then Browser Operator navigates the web in a visible Chromium surface
    And the user can refine the request conversationally

  Scenario: Run a research-agent task
    Given the user selects the Research Agent mode
    When the user enters a complex research brief
    Then Browser Operator plans and gathers web information through the browser
    And returns synthesized output inside the agent conversation

  Scenario: Use local or alternate model providers
    Given an advanced user wants model control
    When the user configures OpenRouter, OpenAI, Groq, or LiteLLM
    Then Browser Operator routes agent reasoning through that provider
    And the user can trade convenience, speed, cost, and privacy by provider choice

  # Good: makes the AI browser pattern local, visible, and provider-flexible.
  # Bad: still needs stronger policy, security, MCP, platform, and context-routing maturity.
