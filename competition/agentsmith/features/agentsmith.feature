Feature: AgentSmith consumer browser automation
  AgentSmith differentiates by packaging browser-agent work as a low-friction Chrome extension for repetitive tasks.

  Scenario: Automate a repetitive browser task from natural language
    Given a user installs the AgentSmith Chrome extension without creating an account
    When the user opens the sidebar and asks it to scrape prices, fill a form, or extract contact data
    Then AgentSmith clicks, types, navigates, scrolls, and extracts results in the visible browser
    And the user can watch each action in real time

  Scenario: Export structured data
    Given a user asks AgentSmith to scrape a table, catalog, search result, or product listing
    When the browser agent finishes extraction
    Then the user can export structured CSV or JSON
    And the workflow can be reused for recurring data work when saved automation is available

  Scenario: Connect a power-user MCP workflow
    Given a developer wants an external LLM to control the browser
    When they enable MCP integration
    Then Cursor, Claude, or another MCP-compatible tool can call AgentSmith for browser control
    And normal extension users can ignore MCP entirely

  # Good: packaging and pricing make browser automation understandable to mainstream users.
  # Bad: missing product screenshots and action limits make reliability and cost hard to judge before use.
