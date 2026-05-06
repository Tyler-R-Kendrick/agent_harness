Feature: Dia tab-aware AI browser
  Dia differentiates by making the browser's URL bar and tabs the main AI context.

  Scenario: Ask about open tabs
    Given a user has multiple research tabs open
    When the user asks Dia a question about those tabs
    Then Dia uses the selected or open tab content as context
    And returns an answer without requiring pasted text

  Scenario: Draft from browsing context
    Given a user is writing an email or document
    When the user asks Dia to draft using current tabs
    Then Dia synthesizes the visible context into a draft
    And applies the user's writing preferences where available

  Scenario: Create a skill shortcut
    Given a user repeats a browser setup or task
    When the user asks Dia to create a Skill
    Then Dia creates a shortcut-like behavior
    And the user can invoke it later without rebuilding the prompt

  # Good: strong bridge from browsing context to writing/research workflows.
  # Bad: less compelling for users who need full autonomous execution and auditability.

