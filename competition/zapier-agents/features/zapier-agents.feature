Feature: Zapier Agents app-connected AI teammates
  Zapier Agents differentiates by giving an AI teammate direct access to Zapier app actions, knowledge sources, and business workflows.

  Scenario: Build an agent with app actions
    Given a Zapier user wants an AI teammate for a business process
    When the user enters instructions and connects app accounts
    Then the agent can use configured actions to complete tasks
    And Zapier Copilot can help add actions or investigate errors

  Scenario: Ground an agent in business knowledge
    Given a team has documents or app data the agent should use
    When the builder adds a knowledge source or search action
    Then the agent can query that source during conversations
    And the user can reference the source in the agent instructions

  Scenario: Measure agent usage
    Given an agent runs actions or messages during work
    When Zapier records successful activities and messages
    Then plan limits and quotas determine how much work the agent can perform
    And testing activity can count toward usage

  # Good: unmatched app integration reach and low setup for Zapier users.
  # Bad: pricing and quota mental model can be hard for exploratory automation.
