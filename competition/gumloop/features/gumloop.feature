Feature: Gumloop AI workflow agents
  Gumloop differentiates by putting AI agents inside a visual workflow system where web research, app actions, and reusable automations are built as flows.

  Scenario: Build an AI research workflow from visual nodes
    Given an operations user needs to enrich records with web and app data
    When the user creates a Gumloop workflow with search, fetch, AI, and CRM nodes
    Then the workflow can run repeatedly from a trigger
    And the user can inspect node outputs and credit usage for each run

  Scenario: Use an agent as a workflow step
    Given a team has a repeatable process with some judgment-heavy decisions
    When the workflow invokes a Gumloop agent node
    Then the agent can reason over context and call configured tools or workflows
    And the deterministic workflow can continue after the agent returns a result

  Scenario: Control usage through model and key choices
    Given a workspace wants lower AI operating costs
    When the builder selects cheaper models or brings their own API key
    Then AI node and agent costs can be reduced
    And the team can review grouped or detailed usage breakdowns

  # Good: AI-native workflow ergonomics and visible cost concepts.
  # Bad: weak page-level browser evidence compared with a browser-first trace.
