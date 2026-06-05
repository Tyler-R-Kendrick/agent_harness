Feature: Agentic WorkFlow browser-native automation
  Agentic WorkFlow differentiates by running visual AI workflows locally inside the browser while preserving access to live page context.

  Scenario: Build a local browser workflow from page context
    Given a user has installed the Agentic WorkFlow browser extension
    And they are viewing a live web page
    When they create a workflow that reads selected text, page HTML, links, or images
    Then the workflow can transform that context through visual nodes
    And return a result back inside the browser

  Scenario: Combine browser actions with AI and API nodes
    Given a workflow needs to extract page data and send it to another service
    When the user connects browser action nodes, AI nodes, and HTTP request nodes
    Then the workflow can click, fill, extract, classify, branch, and call an external API
    And each node can pass structured output to later nodes

  Scenario: Reuse community workflow templates
    Given a user wants to automate a common browser task
    When they browse the Agentic WorkFlow template library or marketplace
    Then they can start from a workflow template
    And customize it for their target page or data pipeline

  # Good: local browser context plus visual node composition is concrete and learnable.
  # Bad: always-on execution, governance, and durable run evidence are less central than workflow building.
