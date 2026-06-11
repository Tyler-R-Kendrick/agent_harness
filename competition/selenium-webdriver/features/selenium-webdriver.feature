Feature: Selenium standards-based browser automation
  Selenium differentiates through cross-browser WebDriver automation and distributed Grid execution.

  Scenario: Drive a browser with WebDriver
    Given a developer has installed a Selenium language binding
    When they create a driver for Chrome, Firefox, Edge, Safari, or another supported browser
    And navigate to a page
    Then Selenium sends browser instructions through WebDriver
    And the same test pattern can be ported across supported languages and browsers

  Scenario: Scale browser sessions with Grid
    Given a QA team needs tests on multiple machines, browsers, or operating systems
    When they route WebDriver commands through Selenium Grid
    Then Grid assigns commands to remote browser instances
    And the team can run tests in parallel across different browser versions and platforms

  Scenario: Reduce driver setup friction
    Given a developer runs Selenium with modern bindings
    When Selenium Manager resolves browser and driver requirements
    Then the developer can start simple browser automation without manually downloading every driver

  # Good: mature, standards-based, cross-browser automation at scale.
  # Bad: not agent-native and still vulnerable to timing, locator, and environment flakes.
