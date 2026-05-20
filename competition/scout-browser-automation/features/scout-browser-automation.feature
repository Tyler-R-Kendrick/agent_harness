Feature: Scout extension-first browser automation
  Scout differentiates by pairing a Chrome extension with an MCP server, CDP sessions, short refs, and token-aware snapshots.

  Scenario: Attach an agent to a real Chrome tab
    Given the Scout Chrome extension and MCP server are running
    When an MCP-compatible agent lists browser tabs
    Then Scout returns tab refs
    And the agent can attach a CDP session to a selected tab without launching a remote browser

  Scenario: Act through semantic refs
    Given the agent has captured an accessibility snapshot
    When Scout returns element refs such as @e12 and @e18
    Then the agent can fill fields, click buttons, and re-snapshot the page using refs
    And it avoids repeating brittle CSS selectors in later tool calls

  Scenario: Coordinate multiple agents across tabs
    Given several agents are active in a Scout session
    When an orchestrator calls agent-roster and assigns work through agent-request
    Then each worker can operate a different tab with independent session state
    And return results to the orchestrator without taking over another agent's tab

  # Good: refs, CDP events, batch actions, and snapshot filters directly target token cost and selector brittleness.
  # Bad: a large local extension plus server plus account model is more complex than a single browser-use library.
