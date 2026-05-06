Feature: ChatGPT Atlas browser-native assistant
  Atlas differentiates by making ChatGPT available in the same browser surface where the user is working.

  Scenario: Ask about the current page without leaving the tab
    Given a user is viewing a web page in Atlas
    When the user opens the Ask ChatGPT sidebar
    And asks for an explanation, extraction, summary, or draft
    Then ChatGPT answers using page context
    And the user stays in the active browsing flow

  Scenario: Escalate from side chat to agent mode
    Given a user has started a task in the browser
    When the user selects Agent mode from the side chat or new-tab prompt
    And describes a multi-step task
    Then the agent uses the current browsing session
    And reports progress in the panel
    And asks for confirmation or handoff when required

  Scenario: Reduce account-risk with logged-out mode
    Given a user wants the agent to browse without account cookies
    When the user chooses logged-out mode
    Then the agent starts without existing cookies
    And does not access logged-in accounts unless explicitly approved

  # Good: same-surface chat and action is extremely ergonomic.
  # Bad: users must understand page visibility, memory, and logged-in risk.

