Feature: Open-source Chrome MCP control
  Chrome MCP Server lets AI assistants control an existing Chrome browser through a Chrome extension and MCP server.

  Scenario: Use the user's existing browser session
    Given a user has Chrome MCP Server installed
    And the Chrome extension is connected to the local MCP server
    When an MCP-compatible assistant requests browser automation
    Then the assistant can interact with the user's existing Chrome tabs
    And the assistant can benefit from existing login state, settings, and extensions

  Scenario: Discover and act across tabs
    Given multiple browser tabs are open
    When the assistant asks Chrome MCP Server for browser context
    Then the server exposes cross-tab context and semantic search
    And the assistant can decide which tab or content to use

  Scenario: Use browser tooling beyond clicks
    Given an assistant is debugging or automating a page
    When it invokes Chrome MCP Server tools
    Then it can use screenshots, network monitoring, interactive operations, bookmarks, browsing history, and content extraction
    And it can combine those tools inside a broader MCP workflow

  Scenario: Edit or inspect a page visually
    Given the user is working with Claude Code or Codex
    When the Visual Editor flow is enabled
    Then the agent can stream tool use while interacting with an in-page overlay
    And the user can inspect page changes in the browser context
