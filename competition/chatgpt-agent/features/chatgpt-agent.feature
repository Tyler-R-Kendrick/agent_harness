Feature: ChatGPT Agent supervised web task execution
  ChatGPT Agent differentiates by turning a chat request into a multi-tool task run across browsing, code, files, and connectors.

  Scenario: Complete a web task with user approval
    Given a paid ChatGPT user asks for a task that requires web interaction
    When ChatGPT Agent opens the web, navigates pages, and reaches a sensitive step
    Then the agent pauses for user confirmation
    And the user can approve, deny, or take over the browser session

  Scenario: Combine browser work with generated files
    Given a user asks ChatGPT Agent to research and prepare an artifact
    When the agent browses sources and uses its code or document tools
    Then it returns a finished file or structured output in the same conversation
    And the user can continue refining the output without switching products

  Scenario: Respect workspace restrictions
    Given an organization has configured ChatGPT workspace controls
    When a user invokes ChatGPT Agent
    Then connector access and risky actions follow the workspace policy
    And the agent asks for confirmations before consequential actions

  # Good: default distribution, multi-tool context, and explicit confirmations.
  # Bad: browser evidence is less inspectable than a developer-first trace.
