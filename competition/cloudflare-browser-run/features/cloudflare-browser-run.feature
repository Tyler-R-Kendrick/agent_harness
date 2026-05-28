Feature: Cloudflare Browser Run
  Cloudflare Browser Run differentiates by putting browser automation on Cloudflare's global developer platform.

  Scenario: Run a Quick Action for agent-readable content
    Given a developer needs rendered content from a dynamic page
    When they call a Browser Run Quick Action such as markdown, screenshot, PDF, links, or crawl
    Then Cloudflare launches a managed browser task
    And the response returns the requested artifact without the developer operating browser hosts

  Scenario: Control a browser session with Playwright
    Given an agent needs direct browser control
    When the developer connects Playwright, Puppeteer, CDP, or Stagehand to Browser Run
    Then the agent can navigate and interact with a remote headless Chrome session
    And the work can run near other Cloudflare Workers and AI infrastructure

  Scenario: Identify automation as a well-behaved bot
    Given a website owner wants compliant automation signals
    When Browser Run uses well-behaved bot mode
    Then the browser identifies itself with cryptographic signatures
    And the workflow distinguishes itself from stealth or evasion-first scraping

  # Good: cheap global browser primitives and Cloudflare platform adjacency are hard to ignore.
  # Bad: session limits, timeouts, and missing productized evidence surfaces leave room for agent-browser.
