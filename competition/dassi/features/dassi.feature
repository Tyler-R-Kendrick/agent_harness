Feature: dassi browser-native task agent
  dassi differentiates by giving mainstream browser users a sidebar agent that can read pages, act locally, and save repeated workflows.

  Scenario: Complete a task on the current page
    Given the user has installed the dassi Chrome extension
    And the sidebar is open on a logged-in web app
    When the user asks dassi to fill a form or draft a reply
    Then dassi reads the page context
    And asks for approval before taking action

  Scenario: Research across tabs
    Given the user has several browser tabs open
    When the user asks for a structured summary
    Then dassi reads relevant page content across tabs
    And compiles a response without copy-pasting into a separate chat app

  Scenario: Save a repeated workflow
    Given the user repeats a browser workflow regularly
    When the user saves it as a skill
    Then dassi can run or schedule that workflow later
    And the user can reuse the automation without writing scripts

  # Good: clear consumer extension flow with approvals and reusable skills.
  # Bad: sidebar-only workflows may struggle with observability, rollback, and complex multi-step state.
