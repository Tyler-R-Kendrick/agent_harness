Feature: Open Browser Use local Chrome bridge
  Open Browser Use differentiates by exposing a real local Chrome profile to AI agents through CLI, MCP, SDK, and skill interfaces.

  Scenario: Install a local browser automation bridge
    Given a developer wants an AI agent to operate their local Chrome
    When they install the CLI and run setup
    Then Open Browser Use registers a native host and prepares the Chrome extension
    And the agent can use a local transport instead of a hosted browser service

  Scenario: Connect an MCP-capable agent
    Given the user's agent runtime supports local MCP stdio servers
    When the user configures `obu mcp`
    Then the agent receives browser tools for tabs, navigation, claiming, CDP, action plans, and cleanup
    And the browser session stays on the user's machine

  Scenario: Build against SDKs
    Given a team wants to embed browser automation in its own runtime
    When it installs the JavaScript, Python, or Go SDK
    Then it can integrate tab and browser control without binding to one agent client
    And can choose CLI, SDK, MCP, or skill entrypoints for different workflows

  # Good: local real-Chrome control plus MCP/SDK/skill packaging is extremely close to agent-browser's adoption path.
  # Bad: the product layer is mostly plumbing, so audit, approvals, trace UI, and team recovery are left to the host agent.
