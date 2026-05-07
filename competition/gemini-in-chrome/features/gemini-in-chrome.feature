Feature: Gemini in Chrome
  Gemini in Chrome differentiates through default-browser distribution, page context, cross-tab reasoning, history recall, Google app integration, and preview agentic browsing.

  Scenario: Ask Gemini about the current tab
    Given a user is browsing a page in Chrome
    When the user opens Gemini in Chrome
    Then Gemini can use the current tab content to answer questions
    And the user can stop sharing the current tab

  Scenario: Compare information across tabs
    Given a user has several product or research tabs open
    When the user shares selected tabs with Gemini
    Then Gemini summarizes and compares those tabs
    And the user avoids manually copying details between pages

  Scenario: Rediscover a page from browsing history
    Given a user has opted into Gemini in Chrome and synced Chrome history
    When the user describes a previously visited page
    Then Gemini searches Chrome history
    And it helps the user resume the prior browsing task

  Scenario: Automate a web task with Auto Browse preview
    Given a U.S. Google AI Pro or Ultra subscriber has access to Auto Browse preview
    When the user asks Gemini to book, plan, or complete a routine task
    Then Gemini acts on webpages on the user's behalf
    And the user remains in control before finalizing sensitive actions

  # Good: default distribution and Google app context make adoption easy.
  # Bad: privacy, storage, availability fragmentation, and browser clutter create backlash risk.
