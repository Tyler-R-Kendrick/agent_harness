Feature: Browserize virtual browser stack
  Browserize differentiates by turning browser-agent infrastructure into a cheap, ready-to-connect MCP, CDP, and NoVNC runtime.

  Scenario: Deploy a virtual browser for an AI agent
    Given a developer needs an isolated browser session for an AI workflow
    When they deploy a Browserize virtual browser
    Then Browserize provisions a browser instance with MCP, CDP, and NoVNC endpoints
    And the developer can connect a Playwright MCP client to the browser endpoint

  Scenario: Monitor a running browser session visually
    Given an agent is executing a browser workflow in a virtual browser
    When the developer opens the NoVNC view
    Then they can inspect the live browser visually
    And they can debug mis-navigation without relying only on text logs

  Scenario: Scale browser capacity with hourly pricing
    Given a team has intermittent browser-agent workloads
    When they run production sessions through Browserize
    Then they pay for actual browser usage time
    And they can avoid maintaining a standing browser fleet

  # Good: clear MCP/CDP/NoVNC contract and simple hourly cost.
  # Bad: delegates agent planning, permissioning, secrets, and durable trace UX to the buyer.
