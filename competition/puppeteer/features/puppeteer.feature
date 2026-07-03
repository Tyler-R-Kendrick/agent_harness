Feature: Puppeteer programmable browser control
  Puppeteer differentiates by giving developers and agent wrappers direct browser control through a compact JavaScript API.

  Scenario: Run a scripted browser workflow
    Given a developer has installed Puppeteer
    When they launch a browser and create a page
    And navigate to a target URL
    And use locators or selectors to type, click, and read content
    Then the workflow runs in a real browser engine
    And the developer can close the browser from code

  Scenario: Use Puppeteer as an MCP browser tool substrate
    Given an MCP host is configured with a Puppeteer-based browser server
    When an agent asks to navigate, click, fill a form, or capture a screenshot
    Then the server maps those tool calls to Puppeteer browser operations
    And returns console logs or screenshots as MCP resources

  Scenario: Customize browser launch behavior
    Given a workflow needs a particular browser binary, viewport, or headed mode
    When the developer configures launch options
    Then Puppeteer runs the browser with that environment
    But unsafe flags and local access need host-level policy controls

  # Good: simple, powerful, widely understood browser-control primitive.
  # Bad: evidence, approvals, replay, and safety boundaries must be built around it.
