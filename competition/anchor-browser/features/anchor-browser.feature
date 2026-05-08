Feature: Anchor authenticated browser-agent infrastructure
  Anchor differentiates by focusing on secure authenticated browser sessions, deterministic tasks, and enterprise computer-use infrastructure.

  Scenario: Create an authenticated browser session
    Given a developer has created an Application for a target website
    And has configured an Identity with credentials or an auth flow
    When the developer creates a browser session with that identity
    Then Anchor starts a browser already prepared for the target app
    And the automation can work past login, MFA, CAPTCHA, geolocation, and session persistence barriers

  Scenario: Let end users connect third-party accounts
    Given a product needs users to authorize browser-agent access to a third-party website
    When the product generates an OmniConnect identity token
    And embeds Anchor's identity creation UI
    Then the end user can complete authentication in a guided flow
    And future agent sessions can use the connected identity

  Scenario: Deploy a reusable TypeScript browser task
    Given a browser workflow has been implemented as TypeScript
    When the developer deploys it through the Tasks API
    Then Anchor versions the task
    And the task can run synchronously or asynchronously in secure browser sessions

  Scenario: Use an AI task with controlled runtime options
    Given a developer wants natural-language task execution
    When the developer calls agent.task with a URL or session ID
    And configures max steps, model/provider, human intervention, element detection, or secret values
    Then Anchor runs the task with a selected agent backend
    And returns structured task output for the caller

  # Good: authentication and task deployment map directly to enterprise production blockers.
  # Bad: delegating logged-in sessions raises trust, compliance, and consent UX concerns.
