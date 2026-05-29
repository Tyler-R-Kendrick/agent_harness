Feature: Official DevTools-backed browser MCP
  Chrome DevTools MCP differentiates by exposing live Chrome control and inspection to coding agents.

  Background:
    Given a developer has an MCP-compatible coding agent
    And Chrome DevTools MCP is installed through npm or a client plugin

  Scenario: Coding agent inspects a live browser
    When the agent connects to Chrome DevTools MCP
    Then it can control and inspect a live Chrome browser
    And it can use DevTools capabilities for automation, debugging, and performance analysis

  Scenario: Developer configures an existing browser target
    Given a browser is already running with a remote debugging endpoint
    When the developer starts Chrome DevTools MCP with a browser URL
    Then the MCP server connects to the existing browser target
    And the agent can work against the same browser instance

  Scenario: Developer reduces tool overhead
    When the developer enables slim mode for basic browser tasks
    Then the server exposes a smaller tool profile
    And the agent spends less context on DevTools capabilities it does not need

  # Good implementation: official setup paths and DevTools depth make it a default candidate.
  # Bad implementation: low-level power still needs product-level approvals, evidence, and recovery UX.
