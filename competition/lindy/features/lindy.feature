Feature: Lindy office workflow agents
  Lindy differentiates by packaging AI agents around inbox, meeting, calendar, follow-up, integration, and computer-use workflows.

  Scenario: Delegate meeting follow-up
    Given a professional connects email and calendar accounts
    When a meeting ends
    Then Lindy can summarize the conversation
    And draft or send follow-up work through connected apps

  Scenario: Build an agent from plain English
    Given a business user has a repetitive workflow
    When the user describes the workflow to Lindy
    Then Lindy creates an AI agent with triggers and actions
    And the user can connect integrations needed by the workflow

  Scenario: Use computer use for a web app task
    Given a task cannot be completed through a native integration
    And the user is on a tier that includes computer use
    When Lindy executes the workflow
    Then Lindy can operate web apps on the user's behalf
    And the result is folded into the broader workflow

  # Good: office workflows are concrete and easy to understand.
  # Bad: browser/computer use is a supporting capability, so evidence and recovery may be thinner than a browser-agent workbench.
