Feature: BrowserOS open-source agentic browser
  BrowserOS differentiates by putting local/BYOK browser agents and MCP integrations inside an open browser.

  Scenario: Run an agent locally in the browser
    Given a user has BrowserOS installed
    And an AI provider or local model configured
    When the user describes a web task in natural language
    Then the browser agent clicks, types, navigates, and extracts information
    And the workflow runs under the user's browser context

  Scenario: Connect apps through MCP
    Given the user wants cross-app automation
    When the user connects Gmail, Slack, Notion, Calendar, or a custom MCP server
    Then BrowserOS can include those app surfaces in browser workflows
    And the browser becomes an agent command center

  Scenario: Schedule recurring browser workflows
    Given a user has a recurring web task
    When the user schedules the task
    Then BrowserOS runs it periodically
    And groups or reports results for review

  # Good: strong local/open/developer-control story.
  # Bad: broad power increases setup, reliability, and governance burden.

