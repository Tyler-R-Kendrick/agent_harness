Feature: LaVague web-agent framework and QA generation
  LaVague differentiates by turning objectives or Gherkin scenarios into browser action code.

  Scenario: Run a web objective through World Model and Action Engine
    Given a developer creates a Selenium, Playwright, or Chrome extension driver
    And they initialize a World Model and Action Engine
    When they ask the WebAgent to complete an objective
    Then the World Model interprets the current page and objective
    And the Action Engine compiles instructions into executable browser actions

  Scenario: Generate Pytest from Gherkin
    Given a QA engineer has a URL and a Gherkin feature file
    When they run lavague-qa against the target page
    Then LaVague executes the scenario through a browser agent
    And it emits a Pytest file that can be run in the test suite

  Scenario: Track token usage and cost
    Given an agent run may call multiple LLMs and tools
    When the developer attaches TokenCounter and logs the run
    Then LaVague records step count, token consumption, and estimated cost
    And the team can inspect which agent components drove spend

  # Good: bridges BDD intent, web-agent exploration, generated tests, and cost tracking.
  # Bad: generated code and early QA workflows still need review before production use.
