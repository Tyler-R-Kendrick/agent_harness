Feature: GitHub Copilot cloud agent
  GitHub Copilot cloud agent differentiates by embedding asynchronous coding work directly into GitHub issue, pull request, IDE, mobile, CLI, and MCP workflows.

  Scenario: Assign an issue to Copilot
    Given a repository has Copilot cloud agent enabled
    When a user assigns an issue to Copilot
    Then Copilot starts a background session
    And creates a pull request for human review when work is ready

  Scenario: Delegate from an IDE
    Given a developer is using Copilot Chat in a supported IDE
    When the developer delegates a prompt to the cloud agent
    Then Copilot creates a branch and pull request from the repository state
    And adds the user as reviewer when the work is complete

  Scenario: Choose a partner coding agent
    Given a paid Copilot plan has third-party agents enabled
    When the user starts a coding-agent task
    Then the user can choose supported agents such as OpenAI Codex or Anthropic Claude
    And the session consumes Copilot premium requests and GitHub Actions minutes

  # Good: unmatched distribution inside existing GitHub workflows.
  # Bad: inspectability depends on GitHub session logs and PR review rather than local proof artifacts.
