Feature: v0 Vercel-native app and UI generation
  v0 differentiates by combining high-quality React UI generation with Vercel-aware code and deployment.

  Scenario: Generate a deployable web project
    Given a user has a product idea
    When the user describes the desired app in v0
    Then v0 generates code and UI for the project
    And the user can preview the result
    And the user can deploy the project to Vercel

  Scenario: Convert design context into implementation
    Given a team has Figma or custom design-system context
    When the user provides that context to v0
    Then v0 uses the design input to generate matching interface code
    And the team can continue iterating in the v0 chat and code surface

  Scenario: Manage usage after pricing moves to credits
    Given a user is on a free, premium, or team plan
    When v0 processes prompts, chat history, source files, and generated output
    Then token usage converts into credits
    And the user must manage v0 credits separately from Vercel deployment usage

  # Good: best-in-class frontend taste and Vercel deployment gravity.
  # Bad: beautiful generated UI can mask incomplete product logic, and credit usage can become hard to predict.
