Feature: Microsoft Copilot Studio enterprise agent authoring
  Microsoft differentiates by embedding agent creation in Microsoft 365 and escalating advanced agents into Copilot Studio governance.

  Scenario: Build a lightweight employee agent from Copilot Chat
    Given an employee has access to Microsoft 365 Copilot
    When they choose New Agent and describe the agent in natural language
    Then Agent Builder drafts the name, description, instructions, and starter prompts
    And the employee can test the agent before creating it

  Scenario: Add richer tools and orchestration in Copilot Studio
    Given a builder needs actions, knowledge, or channel publishing
    When they move into the full Copilot Studio experience
    Then they can author topics
    And configure tools, knowledge sources, and connectors
    And publish to supported Microsoft and external channels

  Scenario: Control paid autonomous usage
    Given an organization runs agents through Power Automate or autonomous triggers
    When an agent invokes paid Copilot Studio capabilities
    Then admins must monitor Copilot credit consumption
    And distinguish employee-facing licensed usage from metered autonomous usage

  # Good: unmatched Microsoft 365 distribution and permission-aware work context.
  # Bad: product, channel, and billing boundaries are easy to misunderstand.
