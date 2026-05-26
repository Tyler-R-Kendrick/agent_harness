Feature: SurfAgent local dedicated browser for AI agents
  SurfAgent differentiates by giving an AI agent a persistent Chrome instance it owns locally.

  Background:
    Given SurfAgent is installed on Windows
    And the SurfAgent daemon is running on localhost
    And the agent is connected through MCP, CDP, or HTTP

  Scenario: Give a coding agent persistent browser access
    Given a coding agent needs to inspect a local web app
    When the agent connects to SurfAgent through MCP
    And navigates to the app in the dedicated Chrome profile
    And captures a screenshot after interacting with the page
    Then the agent should use the persistent browser without controlling the user's personal browser
    And the browser session should survive restarts

  Scenario: Recover from browser failure during an unattended run
    Given a long-running extraction task is using the SurfAgent-managed browser
    When Chrome hangs or exits
    Then SurfAgent should detect the failed health check
    And restart the dedicated browser without manual intervention

  Scenario: Extract and crawl through a local real browser
    Given an agent needs structured data from a dynamic site
    When it calls SurfAgent's extract, crawl, or map endpoints
    Then the request should run through local Chrome with the agent's persistent profile
    And the response should return structured data, markdown, links, or discovered URLs

  # Differentiation:
  # - Good: strong local ownership, session persistence, and predictable one-time pricing.
  # - Bad: local daemon plus powerful logged-in browser access needs unusually visible permission and exfiltration controls.
