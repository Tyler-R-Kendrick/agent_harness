Feature: Apify Actor marketplace for agent web data
  Apify differentiates by exposing a large marketplace of reusable web automation Actors to developers, AI agents, and automation buyers.

  Scenario: Run a prebuilt web data Actor
    Given a user needs structured data from a popular website
    When they search Apify Store and select a relevant Actor
    Then they can configure JSON input and run the Actor
    And the result is stored in Apify datasets, files, logs, or other platform storage

  Scenario: Let an AI agent discover and run Actors through MCP
    Given an AI client supports MCP
    When the user connects Apify's hosted MCP server
    Then the agent can search Actors, inspect Actor details, call selected Actors, and retrieve run results
    And the agent can use structured output schemas when supported

  Scenario: Publish and monetize an automation
    Given a developer has built a reusable scraper or workflow
    When they publish it as an Apify Actor
    Then it can be distributed through Apify Store
    And the developer can monetize usage while Apify handles cloud runs, storage, API access, and marketplace discovery

  # Good: the Actor marketplace captures repeatable jobs faster than a blank browser-agent canvas.
  # Bad: quality and cost vary by Actor, and abandoned/experimental Actors can degrade trust.
