Feature: Enterprise test platform access through MCP
  BrowserStack MCP differentiates by connecting AI coding assistants to BrowserStack's real-device and testing cloud.

  Scenario: Run cross-browser tests from an AI coding assistant
    Given a developer has BrowserStack credentials
    And has configured the BrowserStack MCP server in their IDE
    When they ask the assistant to run web automation tests
    Then the MCP server invokes BrowserStack Automate
    And the assistant can return session links, screenshots, logs, or failure context

  Scenario: Generate or manage tests from natural language
    Given a QA team maintains product requirements and manual tests
    When an assistant invokes BrowserStack test management tools
    Then it can create test cases, convert manual cases to low-code automation, or update test results
    And the work stays connected to BrowserStack's test-management system

  Scenario: Analyze and heal a flaky test
    Given a BrowserStack session failed because selectors changed
    When the assistant invokes BrowserStack AI agents through MCP
    Then it can fetch failure analysis and self-healed selectors
    And apply a suggested code fix from the IDE

  # Good: real-device coverage and QA workflows are stronger than generic browser tools.
  # Bad: account licensing and test-platform scope limit general browser-agent use.
