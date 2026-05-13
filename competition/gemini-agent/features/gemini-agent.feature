Feature: Gemini browser-agent task flow
  Gemini Agent differentiates through Google ecosystem context and Project Mariner-style supervised browser interaction.

  Scenario: Ask Gemini to perform a browser task
    Given a user is signed in to a Google account
    And Gemini has access to browser or page context
    When the user asks Gemini to complete a web task
    Then Gemini plans steps, reads the page, and interacts with browser elements
    And the user can inspect or interrupt the run

  Scenario: Use Google account context
    Given the task depends on Google ecosystem data
    When Gemini needs Gmail, Calendar, Drive, or Search context
    Then it can combine account-connected context with browser navigation
    And the user does not need to configure a separate automation platform

  Scenario: Keep a user in the loop
    Given the agent reaches an action that changes user data or external state
    When the action needs confirmation
    Then Gemini asks the user before completing the step
    And preserves the visible browser context for review

  # Good: unmatched Google distribution and account context.
  # Bad: exact product boundaries and availability can be confusing as research features graduate into Gemini plans.
