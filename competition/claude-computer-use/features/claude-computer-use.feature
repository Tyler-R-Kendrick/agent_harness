Feature: Claude computer-use API
  Claude Computer Use differentiates by exposing whole-computer action primitives to developers rather than shipping only a browser app.

  Scenario: Operate a sandboxed browser through screenshots
    Given a developer has enabled Claude computer use in a sandbox
    When Claude receives a screenshot and a user task
    Then Claude can move the cursor, click, type, and inspect the next screenshot
    And the host app records the action trajectory for review

  Scenario: Enforce application-level policy
    Given an enterprise app wraps Claude computer use
    When Claude attempts a sensitive action
    Then the host app can require approval, block the action, or restrict the domain
    And the security policy remains outside the model prompt

  Scenario: Use non-browser software
    Given a workflow spans desktop software and browser pages
    When Claude needs to interact with both surfaces
    Then the computer-use tool can operate them through the same screenshot and action loop
    And the product is not limited to DOM-accessible web apps

  # Good: flexible whole-computer primitive for developers.
  # Bad: app builders inherit the hardest UX, security, and reliability work.
