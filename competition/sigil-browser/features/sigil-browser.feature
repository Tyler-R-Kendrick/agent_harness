Feature: Guardrailed local Chrome automation
  Sigil lets an enterprise user connect an AI assistant to the real Chrome profile while policy controls and audit logs bound what the agent can do.

  Scenario: Connect an AI assistant to a live Chrome session
    Given an enterprise user installs Sigil
    And the user connects an MCP-compatible assistant
    When the assistant requests browser access
    Then Sigil connects the assistant to the user's live Chrome browser
    And the assistant can use the user's existing sessions, SSO, bookmarks, and extensions

  Scenario: Enforce deterministic browser guardrails
    Given an administrator defines browser security rules
    And a rule blocks sensitive actions such as sending email
    When an AI agent attempts a blocked browser action
    Then Sigil enforces the restriction outside the prompt
    And the user can review the blocked or allowed action in the audit log

  Scenario: Reduce browser context for the agent
    Given the agent needs to understand a web page
    When Sigil prepares browser context
    Then it sends a semantic snapshot with the elements needed to navigate and act
    And it avoids sending the full DOM or a screenshot as the default context payload

  Scenario: Monitor agent actions after a run
    Given an AI assistant has completed a browser workflow
    When the user reviews Sigil
    Then Sigil shows the actions the agent took
    And the user can evaluate whether the run stayed inside the intended browser authority
