Feature: Devin autonomous engineering sessions
  Devin differentiates by turning tickets and chat requests into long-running engineering sessions that create reviewable pull requests.

  Scenario: Create a pull request from an assigned repository task
    Given a team has connected Devin to its GitHub organization
    And a user starts a Devin session for a scoped engineering task
    When Devin completes the implementation
    Then Devin creates or updates a pull request
    And the user can review, comment, and ask Devin to iterate

  Scenario: Manage enterprise agent spend
    Given an enterprise uses Devin across several repositories
    When admins inspect consumption reporting
    Then they can see spend by sessions, reviews, repositories, and product categories
    And they can cap session ACU use when governance requires it

  Scenario: Start work from collaboration systems
    Given a team works from Slack, Teams, Jira, Linear, or GitHub
    When a user mentions or assigns Devin from that system
    Then Devin starts a tracked session
    And returns progress and pull request links to the existing workflow

  # Good: strong handoff through PRs, comments, integrations, and enterprise controls.
  # Bad: high-cost autonomous work can hide wrong turns until review time.
