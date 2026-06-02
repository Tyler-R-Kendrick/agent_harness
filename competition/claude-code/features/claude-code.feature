Feature: Claude Code terminal agent workflow
  Claude Code differentiates by putting an agentic coding loop directly inside the terminal with project memory, tools, extensions, and verification.

  Scenario: Run a full coding task from the terminal
    Given a developer is inside a repository
    When they ask Claude Code to fix a bug
    Then Claude gathers project context
    And edits files
    And runs relevant commands or tests
    And iterates until it can report what changed and what was verified

  Scenario: Preserve project instructions across sessions
    Given a repository contains a CLAUDE.md file
    And Claude Code has saved useful project memory
    When the developer starts a new task
    Then Claude uses the repository conventions and remembered patterns
    And avoids re-learning basic workflow details

  Scenario: Extend the agent with controlled capabilities
    Given a team has repeatable review and deployment workflows
    When they add skills, hooks, subagents, or MCP servers
    Then Claude Code can invoke those capabilities at the right point
    And policy scripts can inspect or block tool behavior

  Scenario: Continue a long task under usage constraints
    Given a Claude Code conversation has become long
    When the user runs compacting or switches model strategy
    Then the task can continue with summarized context
    And the user can reduce unnecessary usage from unrelated history

  # Good: project memory, hooks, subagents, and MCP make agent behavior customizable and repeatable.
  # Bad: terminal transcripts and usage limits can make visual/browser proof and long-session cost hard to reason about.
