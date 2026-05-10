Feature: Playwright MCP browser control for AI agents
  Playwright MCP differentiates by exposing real browser automation to agents through structured accessibility snapshots and deterministic element refs.

  Scenario: Navigate and act through an accessibility snapshot
    Given an MCP-capable assistant has Playwright MCP configured
    When the user asks the assistant to interact with a web page
    Then the assistant navigates the browser
    And reads a structured accessibility snapshot
    And uses element refs from the snapshot to click, type, and inspect page state

  Scenario: Generate test selectors from a live app
    Given a developer needs tests for an app with dynamic or undocumented selectors
    When the assistant uses Playwright MCP against the live browser session
    Then it can inspect DOM and accessibility state before authoring tests
    And it can generate more precise Playwright steps than it could from screenshots alone

  Scenario: Reuse or isolate browser state
    Given a developer needs authenticated or clean-room browsing
    When they configure persistent profiles, isolated contexts, storage state, or an extension connection
    Then Playwright MCP can run with the desired browser state model
    And the assistant can continue browser work across multiple tool calls when the session remains valid

  # Good: official Playwright distribution, accessibility refs, and MCP compatibility make adoption extremely cheap.
  # Bad: viewport mismatch, profile locks, transport/session bugs, and prompt-injection exposure remain product risks.
