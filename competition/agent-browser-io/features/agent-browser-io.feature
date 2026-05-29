Feature: Token-efficient wireframe browser control
  Agent Browser differentiates by giving agents compact ASCII page representations with numbered refs.

  Background:
    Given a developer has installed `@agent-browser-io/browser`
    And an MCP client or AI SDK app can call the browser tools

  Scenario: Agent navigates using wireframes
    When the agent launches a browser and navigates to a page
    Then it can request a wireframe representation of the page
    And interactive elements are assigned numeric refs
    And the agent can click, type, fill, scroll, or screenshot using those refs

  Scenario: Developer embeds browser tools in an AI SDK app
    When the developer creates browser tools for a Vercel AI SDK model call
    Then the model can use browser actions as structured tools
    And the app can bound execution with step-count controls

  Scenario: User manually tests the tool
    When the user runs the CLI
    Then they can exercise the same browser control surface outside MCP
    And failures can be debugged with direct commands

  # Good implementation: wireframes and refs lower token cost and simplify target selection.
  # Bad implementation: compact state needs complementary visual evidence for trust and review.
