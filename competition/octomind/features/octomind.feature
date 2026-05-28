Feature: Octomind AI-powered end-to-end testing
  Octomind differentiates by turning browser-agent runtime context into stable, self-healing web tests for product and engineering teams.

  Scenario: Create a web test without writing Playwright manually
    Given a product, QA, or engineering user has a critical browser flow
    When the user records actions, edits visually, or prompts Octomind to create a test
    Then Octomind generates a structured test case
    And the team can run it in local or cloud environments

  Scenario: Debug a failed browser test
    Given a test fails in CI
    When the user opens the Octomind report
    Then the user sees screenshots, logs, traces, visual diffs, and run history
    And can compare failed and successful runs to identify the regression

  Scenario: Heal a broken selector
    Given a UI change breaks a selector
    When Octomind evaluates the original user intent with DOM context, accessible roles, text labels, frames, and shadow roots
    Then it proposes a permanent source-level selector update
    And a reviewer can approve the fix in the dashboard

  Scenario: Test private apps safely
    Given a web app is behind a firewall
    When the team configures a private location worker
    Then Octomind can execute tests against the private app
    And the team controls when and how Octomind can access it

  # Good: runtime evidence and source-level healing are stronger than generic "AI wrote a test" claims.
  # Bad: self-healing can become dangerous if it optimizes for green tests instead of preserved intent.
