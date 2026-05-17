Feature: n8n AI agent workflow orchestration
  n8n differentiates by combining an open workflow engine with AI agent nodes, tool calls, approvals, code, and self-hostable execution.

  Scenario: Route an AI tool call through human approval
    Given an n8n workflow includes an AI Agent node with a risky tool
    When the agent decides to call that tool
    Then the workflow sends the request to a human reviewer
    And the agent receives the approval or denial result before continuing

  Scenario: Build a workflow with AI Workflow Builder
    Given a cloud user describes an automation in natural language
    When n8n AI Workflow Builder creates or modifies the workflow
    Then the user can inspect the resulting nodes
    And each builder interaction consumes an AI Workflow Builder credit

  Scenario: Mix deterministic automation and agent reasoning
    Given a team has a predictable high-volume process with occasional ambiguity
    When deterministic nodes handle triggers, transforms, and app writes
    Then the AI Agent node can handle only the ambiguous decision step
    And execution logs preserve the workflow path

  # Good: self-hostable control and explicit workflow structure.
  # Bad: complex graphs can become maintenance work and may not preserve browser evidence.
