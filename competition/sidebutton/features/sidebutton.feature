Feature: SideButton knowledge-pack browser automation
  SideButton differentiates by combining MCP browser tools, YAML workflows, a dashboard, and app-specific knowledge packs.

  Scenario: Connect a coding agent to browser tools
    Given a developer starts SideButton with "npx sidebutton@latest"
    When the developer adds the local MCP endpoint to Claude Code, Codex, Cursor, or another MCP client
    Then the agent can navigate, click, fill forms, take snapshots, and extract data from a connected browser tab
    And the developer can inspect browser status through the dashboard

  Scenario: Reuse app knowledge across agent runs
    Given a team has installed a knowledge pack for a web app
    When an agent needs to operate that app
    Then SideButton provides selectors, data models, state machines, role playbooks, and common tasks
    And the agent starts with domain-specific context instead of rediscovering the UI from scratch

  Scenario: Turn a manual process into a repeatable workflow
    Given a user has recorded or authored a YAML workflow
    When the user calls the workflow through MCP or REST
    Then SideButton chains browser, shell, LLM, data, and control-flow steps
    And run logs preserve timing, variables, and errors for review

  # Good: knowledge packs and run logs make repeated web work more inspectable than raw browser automation.
  # Bad: stale selectors or over-broad packs can create hidden failure modes that look like agent reasoning failures.
