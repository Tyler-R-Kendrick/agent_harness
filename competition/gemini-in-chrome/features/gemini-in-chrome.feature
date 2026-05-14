Feature: Gemini in Chrome
  Gemini in Chrome differentiates through default-browser distribution, page context, cross-tab reasoning, history recall, Google app integration, preview agentic browsing, and AI Pointer point-and-ask interactions.

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

  Scenario: Ask about the pointed part of a webpage
    Given a user is viewing a webpage in Chrome
    When the user points at a word, paragraph, image region, code block, product, or place
    And asks a shorthand question such as "what does this mean"
    Then Gemini grounds the answer in the pointed page region
    And it preserves page title, URL, pointer coordinates, and visible semantic context

  Scenario: Compare selected products from the same page
    Given a shopping page shows several products
    When the user selects a few products and asks to compare them
    Then Gemini treats "these" as the selected products
    And returns an in-flow comparison without requiring copied product descriptions

  Scenario: Visualize or edit the pointed region
    Given a user points at an image or room region
    When they ask to edit the image or visualize a new object there
    Then Gemini drafts an image-editing or visualization task with the pointed region as the target
    And it asks for confirmation before applying or exporting external changes

  Scenario: Turn pointed pixels into actionable entities
    Given a pointed region contains a place, date, object, recipe, statistic table, or note
    When the user asks a compact command such as "show me directions", "double this", or "chart that"
    Then Gemini extracts a structured entity from the pointer context
    And suggests the relevant map, recipe-scaling, charting, or object-edit action

  # Good: default distribution and Google app context make adoption easy.
  # Bad: privacy, storage, availability fragmentation, browser clutter, and pointer-context overreach create backlash risk.
