Feature: Make AI Agents visual workflow orchestration
  Make AI Agents differentiates by putting reusable AI agents inside Make's visual automation canvas and app-integration system.

  Scenario: Configure a reusable team agent
    Given a Make team wants one agent shared across workflows
    When a user creates an agent with a model, system prompt, context, and tools
    Then the agent is available to team members
    And scenarios can invoke it through a Run an agent module

  Scenario: Combine AI decisions with deterministic modules
    Given a workflow needs judgment-heavy selection and reliable app actions
    When a Make scenario runs an AI agent and passes the result to modules
    Then the agent can decide while Make handles the orchestration
    And the user can inspect decisions and scenario behavior

  Scenario: Extend an agent with MCP and context
    Given an agent needs external tools and reference material
    When the builder adds context files and MCP server tools
    Then the agent can use those resources during execution
    And tool access can be constrained to selected capabilities

  # Good: visual orchestration, shared agents, and transparency messaging.
  # Bad: browser-specific traces and exact visual validation are not primary artifacts.
