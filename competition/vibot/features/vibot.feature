Feature: Vibot self-hosted browser automation platform
  Vibot differentiates by packaging browser automation, workflows, monitoring, and AI-agent infrastructure into one self-hosted stack.

  Scenario: Build a visual browser workflow
    Given a user starts the Vibot server locally
    When they use the dashboard to record browser actions or assemble workflow steps
    Then they can create a reusable browser automation with more than 25 step types
    And the workflow can be scheduled or triggered by webhook

  Scenario: Extract structured website data
    Given a user needs scraping or monitoring output
    When they define an extraction plan with selectors, JSON-LD parsing, pagination, and fallback behavior
    Then Vibot exports structured JSON or CSV
    And per-host backoff helps avoid overly aggressive crawling

  Scenario: Route agent work through MCP and local models
    Given a team wants AI-powered browser agents without a cloud platform
    When they configure MCP tool routing, vision-action loops, and local or cloud models
    Then multiple agents can run browser work through the self-hosted control plane
    And monitoring surfaces failures through metrics and webhooks

  # Good: combines workflows, MCP, CLI, scheduling, extraction, and monitoring in one self-hosted product.
  # Bad: platform breadth can bury the simple browser-evidence loop a user needs to trust an agent.
