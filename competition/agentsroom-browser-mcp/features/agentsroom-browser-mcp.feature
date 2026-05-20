Feature: AgentsRoom embedded browser verification
  AgentsRoom Browser MCP differentiates by giving QA and coding agents a visible per-project Chromium browser through MCP.

  Scenario: Enable browser access for a QA agent
    Given a developer has an AgentsRoom project with a QA agent
    When the developer enables Browser access for that agent
    Then AgentsRoom adds the browser MCP entry to the project MCP configuration
    And the agent receives tools to navigate, click, type, screenshot, evaluate JavaScript, wait for elements, inspect page state, and read console logs

  Scenario: Verify a local web feature end to end
    Given a development server is running on localhost
    When the QA agent opens the app in the embedded Chromium browser
    Then it can exercise the user flow through a real rendered page
    And return screenshots, console errors, and verification notes before handing work back to the developer agent

  Scenario: Keep project browser sessions isolated
    Given multiple projects are open in AgentsRoom
    When agents use browser automation in separate projects
    Then each project uses its own Chromium session partition
    And cookies, localStorage, and auth state do not leak between projects

  # Good: the visible browser plus console logs match the evidence users expect from real QA.
  # Bad: adopting the browser feature means buying into a full multi-agent IDE workflow, not just adding a small browser tool.
