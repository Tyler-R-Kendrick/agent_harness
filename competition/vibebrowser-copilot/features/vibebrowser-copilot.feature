Feature: VibeBrowser real-session browser MCP
  VibeBrowser differentiates by exposing the user's real logged-in browser session as a local or remote MCP surface.

  Scenario: Connect a coding agent to the user's browser
    Given the user has installed the VibeBrowser extension
    And MCP external control is enabled
    When the user configures an agent with the VibeBrowser MCP server
    Then the agent can navigate, click, fill, scroll, inspect, and screenshot the real browser
    And the user keeps their existing cookies, tabs, extensions, and authenticated state

  Scenario: Fill a password without revealing it to the model
    Given a credential is stored in the VibeBrowser secrets vault
    When the agent needs to sign in to a site
    Then VibeBrowser can type the secret into the page
    And the model does not receive the secret value in context

  Scenario: Reuse a successful workflow as a skill
    Given a user completed a repeated browser workflow
    When the user saves it as a skill
    Then the workflow can be triggered later from the browser co-pilot or an MCP-connected agent
    And the same browser context and approval controls are preserved

  # Good: strong local/authenticated-browser and MCP integration story.
  # Bad: shared real-session control needs strong audit, locking, and revocation UX.
