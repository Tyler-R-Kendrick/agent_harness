Feature: Cursor background coding agents
  Cursor differentiates by letting developers launch asynchronous coding agents from the IDE and inspect the branch output in their normal code workflow.

  Scenario: Launch a background agent from the IDE
    Given a developer has connected a GitHub repository to Cursor
    And the repository has an environment configuration
    When the developer starts a background agent with a task prompt
    Then Cursor creates an isolated remote machine
    And the agent edits code on a dedicated branch

  Scenario: Take over an agent machine
    Given a background agent is running
    When the developer opens the agent status view
    Then they can inspect progress
    And enter the remote machine or continue the work locally

  Scenario: Review a pull request with Bugbot
    Given a pull request is open
    When Bugbot runs automatically or from a trigger comment
    Then it posts bug, security, or quality findings
    And the developer can use Cursor to address accepted findings

  # Good: tight loop between IDE, branch, remote runtime, and PR review.
  # Bad: less suited to non-code browser evidence and can create review noise.
