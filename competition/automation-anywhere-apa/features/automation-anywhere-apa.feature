Feature: Automation Anywhere Agentic Process Automation
  Automation Anywhere differentiates by packaging autonomous agents inside an enterprise RPA and orchestration platform.

  Scenario: Deploy an autonomous workstation agent
    Given an automation team has access to the Agentic App Store
    When they deploy EnterpriseClaw
    And provide a goal prompt and enabled tools
    Then the agent can work with files, browse the web, write code, and complete multi-step tasks
    And the package can run on supported Windows or macOS workstations

  Scenario: Orchestrate an enterprise process
    Given a business workflow spans SaaS apps, legacy systems, documents, and human decisions
    When the team models it in Automation Anywhere's APA platform
    Then AI agents, RPA bots, APIs, and governance controls can participate in the same workflow

  Scenario: Start from a marketplace package
    Given a team needs a common business automation
    When they search the Automation Anywhere Bot Store or Agentic App Store
    Then they can adopt a packaged agent or automation asset
    And reduce custom bot development time

  # Good: marketplace packaging and cloud-native control room lower enterprise adoption friction.
  # Bad: agentic features can be expensive and immature for deterministic high-volume work.
