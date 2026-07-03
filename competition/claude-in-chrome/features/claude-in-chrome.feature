Feature: Claude Code browser automation through Chrome
  Claude Code with Chrome differentiates by bringing visible browser actions into a first-party coding-agent workflow.

  Scenario: Test a web app from Claude Code
    Given a developer has connected the Chrome extension to Claude Code
    When they ask Claude to test a local or deployed web app
    Then Claude opens a visible Chrome tab
    And interacts with the page to inspect UI behavior
    And reports findings back in the coding conversation

  Scenario: Use existing browser login state
    Given the user is already signed in to a web application in Chrome
    When Claude opens the site for a browser task
    Then it can use the existing browser session
    And it pauses when login, CAPTCHA, or human-only steps are required

  Scenario: Recover from extension connection problems
    Given the extension fails to connect to Claude Code or Claude Desktop
    When the user follows troubleshooting guidance
    Then they restart or update the extension
    And verify matching accounts, cookies, and native messaging state
    And confirm browser tools are registered before retrying the task

  # Good: first-party browser control becomes part of coding-agent iteration.
  # Bad: beta connection and tool-registration failures interrupt the core experience.
