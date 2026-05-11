Feature: Real Chrome automation with human handoff
  Agent360 Browser MCP differentiates with CAPTCHA solving, real Chrome profile access, and human-in-the-loop controls.

  Scenario: Run a logged-in SaaS automation from Claude Code
    Given the user has installed Agent360 Browser MCP
    And their Chrome profile is already logged into the target SaaS app
    When Claude Code invokes browser navigation, click, and fill tools
    Then the automation runs against the real Chrome session
    And provider-specific integrations can extract tokens when explicitly requested

  Scenario: Ask the human for sensitive intervention
    Given a workflow reaches 2FA, CAPTCHA, or credential entry
    When the agent calls a human-in-the-loop browser tool
    Then an in-page overlay asks the user for the needed input
    And the agent can continue without receiving raw secrets in its prompt history

  Scenario: Keep concurrent assistant sessions separate
    Given multiple Claude Code conversations need browser control
    When Agent360 starts browser sessions for each conversation
    Then each session gets a separate color-coded Chrome tab group
    And actions from one conversation do not collide with another session

  # Good: solves real-world blockers that simple browser MCPs avoid.
  # Bad: broad browser permissions and token/CAPTCHA features create governance risk.
