Feature: Browserbase production browser agents
  Browserbase differentiates by providing managed browser infrastructure and Stagehand's mixed AI/code control.

  Scenario: Run a prompt-guided browser workflow with code control
    Given a developer has a Browserbase API key
    And has installed Stagehand
    When the developer starts a browser session
    And calls an AI action such as act or extract
    Then Stagehand performs the requested browser step
    And the developer can interleave Playwright logic where precision is needed

  Scenario: Debug a production browser run
    Given an automation failed in production
    When the developer opens Browserbase observability artifacts
    Then they can inspect logs, live view, session recordings, and step output
    And update the script or prompt based on concrete evidence

  Scenario: Reach authenticated or bot-protected web surfaces
    Given a workflow needs logged-in state, CAPTCHA handling, or identity support
    When the developer configures Browserbase sessions and identity features
    Then the agent can access more of the interactive web than a raw fetch/API workflow

  # Good: production debugging and Playwright interop are strong.
  # Bad: cost, cloud dependence, and complex primitives may deter small/local-first users.

