Feature: Browser Use Cloud automation modes
  Browser Use Cloud differentiates through natural-language agents, raw browser sessions, and Skills.

  Scenario: Run a one-off natural-language browser task
    Given a developer has a Browser Use API key
    When they call run with a task such as listing Hacker News posts
    Then Browser Use creates or uses a browser session
    And returns task output from the agent

  Scenario: Control a browser session directly
    Given a developer needs custom automation behavior
    When they create a browser session
    Then Browser Use returns a CDP URL
    And the developer connects Playwright, Puppeteer, or Selenium

  Scenario: Turn a repeated workflow into a Skill
    Given a user has a repeated extraction or form workflow
    When they describe the goal and provide a demonstration
    Then Browser Use builds a production-ready API endpoint
    And future calls execute without a full browser agent session

  # Good: explicit abstraction ladder from prompt to deterministic endpoint.
  # Bad: users must price and govern each mode separately.

