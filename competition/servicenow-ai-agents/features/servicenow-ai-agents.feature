Feature: ServiceNow governed autonomous workforce
  ServiceNow differentiates by making AI agents part of governed enterprise workflows with orchestration, approvals, and control-tower oversight.

  Scenario: Build an agent team from a business outcome
    Given a ServiceNow customer wants to automate a support or operations workflow
    When a builder describes the desired outcome in AI Agent Studio
    Then ServiceNow creates or configures agents around the workflow
    And AI Agent Orchestrator coordinates specialist agents toward the goal

  Scenario: Govern agent sprawl through AI Control Tower
    Given an enterprise has multiple AI agents and workflows across systems
    When AI Control Tower discovers and monitors those agents
    Then stewards can observe usage, cost, permissions, and risk
    And pause or shut down agents that exceed policy

  Scenario: Build ServiceNow apps through coding agents
    Given a developer works in Cursor, Windsurf, Claude Code, or GitHub Copilot
    When they use ServiceNow Build Agent skills
    Then they can create ServiceNow apps and agents with platform context
    And App Engine governance can review work before deployment

  # Good: governance, approvals, and operational records are first-class.
  # Bad: effectiveness depends on ServiceNow data quality and cross-tool context completeness.
