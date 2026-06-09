Feature: Bolt.new browser-native full-stack builder
  Bolt.new differentiates by giving an AI agent control over a real in-browser development environment powered by StackBlitz WebContainers.

  Scenario: Build and run a full-stack app in the browser
    Given a user opens Bolt.new
    When the user prompts for a web app
    Then Bolt generates project files
    And installs packages, starts the dev server, and shows a live preview through WebContainers

  Scenario: Import or export through developer workflows
    Given a user has an existing project or wants to continue outside Bolt
    When the user opens a public GitHub repository with a Bolt URL, connects GitHub, opens the project in StackBlitz, or downloads the project as a zip
    Then the project can move between Bolt and conventional development tools

  Scenario: Publish a project from the workspace
    Given a generated app is ready to share
    When the user selects Publish
    Then Bolt deploys using Bolt hosting by default
    And supported projects can publish through Netlify when configured

  # Good: AI can operate the same runtime it is changing, including packages, terminal, server, and preview.
  # Bad: token costs and WebContainer limits make debugging loops visibly painful.
