Feature: Extension-hosted MCP browser control
  Browser for AI Agent differentiates by exposing real browser tabs and page tools to user-configured agents.

  Background:
    Given the user has installed the browser extension
    And the native messaging host is registered locally

  Scenario: Agent reads and controls browser tabs
    When the user connects a trusted MCP agent
    Then the agent can read tab content and metadata
    And the agent can control tabs and windows through extension background scripts
    And the extension can expose screenshots, page errors, cookies, and localStorage when authorized

  Scenario: Page provides agent-callable tools
    Given a page or subscribed toolset exposes page tools
    When the agent requests an operation that matches a page tool
    Then Browser for AI Agent can route the call to that page-specific tool
    And the tool can execute a structured operation inside the tab

  Scenario: User evaluates security risk
    When the user configures agents or toolsets
    Then the README warns about prompt injection and malicious tools
    And the user must only connect trusted agents and trusted tool sources

  # Good implementation: WebMCP/page-tool support is forward-looking and security warnings are explicit.
  # Bad implementation: cookie, storage, and script access need stronger UX than README warnings alone.
