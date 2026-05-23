Feature: Bright Data Agent Browser
  Bright Data Agent Browser differentiates by combining browser automation for AI agents with web-unlocking infrastructure.

  Scenario: Navigate a difficult public website
    Given an AI agent needs to interact with a public website that uses bot defenses
    When the agent uses Bright Data Agent Browser
    Then Bright Data can run a cloud browser with fingerprinting, proxy geography, CAPTCHA solving, cookies, JavaScript rendering, and retries
    And the agent can continue a multi-step web workflow through API or MCP access

  Scenario: Integrate existing browser automation scripts
    Given a team already has Puppeteer, Selenium, or Playwright scripts
    When they connect those scripts to Bright Data Agent Browser
    Then the scripts can run on Bright Data browser infrastructure
    And automated proxy management and web unlocking are handled by the platform

  Scenario: Give an MCP client web data tools
    Given a user has an MCP-capable assistant
    When they configure Bright Data MCP
    Then the assistant can search, scrape, extract markdown, use browser automation, and access global IP network capabilities
    And the free tier can support testing, development, or light usage

  # Good: hard-site access, proxies, CAPTCHA solving, and MCP tooling are strong practical differentiators.
  # Bad: the same capabilities increase governance, abuse-boundary, credential, and cost-transparency demands.
