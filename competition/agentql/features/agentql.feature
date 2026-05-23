Feature: AgentQL semantic web queries
  AgentQL differentiates by letting developers use natural-language-shaped queries for web element discovery, extraction, and automation.

  Scenario: Debug a web query before coding
    Given a developer wants to locate elements on a live page
    When they install the AgentQL Debugger and enter a query in Chrome DevTools
    Then AgentQL returns matching page elements
    And hovering a result highlights the corresponding element on the page

  Scenario: Replace brittle selectors with prompts
    Given an automation script needs to click a search button and fill a modal
    When the developer wraps a Playwright page with AgentQL
    Then the script can call getByPrompt or queryElements
    And AgentQL resolves described page elements into actionable handles

  Scenario: Extract typed data from a web page
    Given an agent or scraper needs structured page data
    When it submits an AgentQL query through an SDK or REST endpoint
    Then AgentQL returns data in the shape requested by the query
    And the same workflow can be used for web pages, PDFs, images, and scheduled scraping jobs

  # Good: semantic queries reduce selector-writing friction and create reusable extraction contracts.
  # Bad: semantic matching needs confidence, screenshots, and fallback traces to avoid quiet wrong-element failures.
