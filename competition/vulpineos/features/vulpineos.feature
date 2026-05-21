Feature: VulpineOS hardened browser-agent runtime
  VulpineOS differentiates by putting browser-agent reliability controls inside a patched browser runtime.

  Scenario: Strip hidden prompt-injection content before the model sees it
    Given an autonomous browser agent requests a page snapshot
    And the page contains hidden DOM, off-screen text, invisible nodes, or ARIA-hidden traps
    When VulpineOS exports the agent-facing accessibility or DOM representation
    Then invisible or hostile nodes are filtered below the JavaScript layer
    And injection attempts can be logged as runtime security events

  Scenario: Freeze page mutation during the agent think step
    Given an agent has read a page and selected a target action
    When VulpineOS enters Action-Lock
    Then timers, reflows, animations, and event handling are suspended while the agent decides
    And the click or type action is sent to the same page state the agent analyzed

  Scenario: Operate a fleet of browser agents
    Given an operator self-hosts VulpineOS with provider keys and browser contexts
    When multiple agents run browser tasks through MCP tools or OpenClaw
    Then the operator can observe sessions, cost budgets, approval gates, proxies, logs, and webhooks
    And agents can use compact snapshots instead of paying for full accessibility-tree dumps on every step

  # Good: runtime-level filtering, page freezing, and token compression attack the category's most common reliability complaints.
  # Bad: anti-detect and proxy positioning may complicate trust, compliance, and acceptable-use review.
