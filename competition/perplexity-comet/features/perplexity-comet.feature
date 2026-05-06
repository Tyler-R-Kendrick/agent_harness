Feature: Perplexity Comet delegated browsing
  Comet differentiates by packaging AI search and browser actions as a personal assistant.

  Scenario: Compare coverage across sources
    Given a user is reading about a current event
    When the user asks how different outlets cover it
    Then Comet uses Perplexity-style synthesis
    And returns a comparison without manual tab-by-tab research

  Scenario: Delegate a shopping task
    Given a user asks for a product matching quality and budget constraints
    When Comet Assistant searches commerce sites
    Then it compares options
    And may proceed toward cart or purchase steps with user oversight

  Scenario: Draft an email from context
    Given the user is in a mail workflow
    When the user asks Comet to draft a reply using schedule context
    Then Comet composes a contextual response
    And the user can review before sending

  # Good: concrete high-frequency chores make the product easy to try.
  # Bad: shopping/email examples are exactly where wrong actions and data exposure hurt most.

