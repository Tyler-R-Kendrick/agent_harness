Feature: Fellou agentic productivity browser
  Fellou differentiates by turning browsing goals into reviewable action plans that can run across web pages, apps, and local files.

  Scenario: Deep search across public and logged-in sources
    Given a user wants a market or recruiting research report
    And the user is logged into relevant platforms
    When the user asks Fellou to research the topic
    Then Fellou searches across public web pages and logged-in sources
    And it compiles a source-backed visual report

  Scenario: Review and edit an action plan before execution
    Given a user asks Fellou to complete a multi-step workflow
    When Fellou generates a task plan
    Then the user can review and edit the steps
    And Fellou executes only after the user accepts the plan

  Scenario: Run a cross-app productivity workflow
    Given a user has browser tabs, SaaS apps, and local files relevant to a task
    When the user delegates the task to Fellou
    Then Fellou transfers context across those surfaces
    And the user can intervene while the agent is running

  # Good: plan-first autonomy reduces black-box fear and maps well to complex research and ops work.
  # Bad: CAPTCHA, complex layouts, prompt injection, and broad account/file access make reliability and security hard.
