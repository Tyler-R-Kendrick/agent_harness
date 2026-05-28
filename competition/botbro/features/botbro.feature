Feature: BotBro local consumer browser automation
  BotBro differentiates by turning repetitive browser work into plain-English local desktop automations.

  Scenario: Create a browser task in plain English
    Given a user installs BotBro on Windows or Mac
    And they connect OpenAI, Anthropic, Gemini, DeepSeek, Ollama, or BotBro's built-in AI
    When they describe a task such as tracking prices or scraping job results
    Then BotBro opens a browser on the user's machine
    And it clicks, fills, navigates, extracts, and exports data without a script

  Scenario: Schedule an automation with alerts
    Given a user wants a recurring website check
    When they schedule a daily, weekly, or custom run
    Then BotBro can monitor the page in the background
    And it can notify the user by SMS when a tracked condition changes

  Scenario: Store credentials as secure variables
    Given a workflow needs login credentials
    When the user adds passwords as secure variables
    Then the automation can use those values locally
    And the product promises they never leave the device

  # Good: consumer packaging and simple pricing make browser automation legible.
  # Bad: scheduled real-browser automation needs stronger failure evidence and approval design.
