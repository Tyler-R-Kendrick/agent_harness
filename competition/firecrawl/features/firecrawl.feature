Feature: Firecrawl web context and browser sessions for agents
  Firecrawl differentiates by giving agents search, scrape, crawl, interact, and browser-session APIs that return LLM-ready web context.

  Scenario: Search the live web and return usable page context
    Given an AI agent needs current information but does not know the target URL
    When it calls Firecrawl search with a natural-language query
    Then Firecrawl returns relevant results with page content in clean Markdown
    And the agent can cite and reason over the returned context without a separate scrape step

  Scenario: Scrape a JavaScript-rendered page into structured JSON
    Given a developer has a target URL and a JSON schema
    When the developer calls scrape with that schema
    Then Firecrawl renders the page as needed
    And returns structured data that matches the requested shape

  Scenario: Use a hosted browser session for interactive extraction
    Given a page requires clicking, scrolling, form entry, or pagination
    When the developer creates a browser session
    And executes browser code or interact actions
    Then the automation can reach hidden data before extraction
    And usage is billed by browser-minute or action credits

  Scenario: Connect Firecrawl through MCP
    Given a user works in Claude, Cursor, Windsurf, Codex, or another MCP host
    When the user configures the hosted Firecrawl MCP endpoint
    Then the assistant can search, scrape, crawl, map, and interact from the same chat workflow

  # Good: clean context and structured extraction reduce page-chrome noise for agents.
  # Bad: self-hosted parity and hidden extraction uncertainty can become trust issues.
