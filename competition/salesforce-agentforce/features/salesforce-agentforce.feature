Feature: Salesforce Agentforce CRM-native digital labor
  Agentforce differentiates by grounding agents in Salesforce data, metadata, permissions, topics, actions, and marketplace distribution.

  Scenario: Build a service agent from topics and actions
    Given a Salesforce admin enables Agentforce for a service workflow
    When they define topics, instructions, and actions in Agentforce Builder
    Then the agent can answer customer requests with Salesforce context
    And invoke approved actions through Salesforce permissions and business logic

  Scenario: Govern responses through the trust layer
    Given an agent needs customer, sales, or service data
    When the agent retrieves context and generates an answer
    Then the Einstein Trust Layer applies data and privacy controls
    And the organization can audit agent actions and outputs

  Scenario: Discover partner agents through AgentExchange
    Given a buyer needs a packaged agent or MCP-enabled extension
    When they search AgentExchange
    Then they can compare partner-built Agentforce solutions
    And install or activate agents within the Salesforce ecosystem

  # Good: deep CRM semantics and governed action model.
  # Bad: pricing, Data 360 dependencies, and naming churn create adoption friction.
