Feature: Lovable prompt-to-product app builder
  Lovable differentiates by combining chat generation, visual edits, backend setup, code access, GitHub sync, and publishing in a single low-code workspace.

  Scenario: Generate and publish a full-stack web app
    Given a builder has a product idea
    When the builder enters an initial prompt in Lovable
    Then Lovable creates a project with a live preview
    And the builder can add backend capabilities through Lovable Cloud or Supabase
    And the builder can publish the current version to a live URL

  Scenario: Make targeted visual edits without writing code
    Given a generated app has a visible layout issue
    When the builder opens Visual Edits and selects the affected element
    Then the builder can change text, colors, fonts, images, spacing, and layout controls
    And Lovable applies the selected edit through the agent

  Scenario: Hand off from no-code editing to code control
    Given a project needs implementation-level changes
    When a paid user opens Code Mode or connects GitHub
    Then the user can inspect files, edit source, reference files in chat, download the codebase, or continue in an external IDE

  # Good: unusually complete loop for non-technical MVP creation.
  # Bad: credit burn, generated-code quality, and production hardening become painful once the app grows past a prototype.
