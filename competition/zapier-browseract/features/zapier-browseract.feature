Feature: BrowserAct workflows through Zapier MCP
  Zapier BrowserAct lets users expose browser automation workflows to AI tools through Zapier MCP.

  Scenario: Run a BrowserAct workflow from an AI assistant
    Given a user has a BrowserAct workflow
    And the user has generated a secure Zapier MCP URL
    When an MCP-compatible assistant invokes BrowserAct
    Then Zapier runs the selected BrowserAct workflow
    And the assistant receives the action result through the MCP connection

  Scenario: Scope BrowserAct actions
    Given a user configures Zapier MCP
    When the user chooses actions for BrowserAct
    Then the assistant is limited to the selected BrowserAct actions
    And the selected actions align with the user's BrowserAct workflows

  Scenario: Use BrowserAct without writing integration glue
    Given a developer wants browser automation inside an AI environment
    When the developer connects Cursor, Claude, or another MCP client to Zapier MCP
    Then the developer can call BrowserAct without hosting a custom MCP server
    And Zapier handles authentication for the generated endpoint

  Scenario: Account for task-based cost
    Given a Zapier account with task quotas
    When an AI assistant makes a BrowserAct MCP tool call
    Then Zapier counts the call against the user's plan tasks
    And the user can increase quota through Zapier plan or task changes
