Feature: Fazm local desktop automation
  Fazm differentiates by using a local Mac agent to operate browser and desktop workflows from voice or shared templates.

  Scenario: Run a desktop task from voice
    Given a user has Fazm installed on macOS
    And required accessibility and screen-capture permissions are granted
    When the user holds the shortcut and speaks a task
    Then Fazm observes the screen locally
    And plans the next action through the configured model
    And moves, types, opens apps, or edits files to complete the task

  Scenario: Share a team workflow template
    Given an admin has created and tested a reusable workflow
    When the admin publishes it to the team library
    Then team members can trigger the workflow by voice or click
    And Fazm runs the workflow locally on each user's machine
    And admins can monitor usage through logs

  Scenario: Enforce enterprise controls
    Given an organization deploys Fazm for a team
    When admins configure app policies, roles, SSO, and approval requirements
    Then users only automate authorized tools and workflows
    And compliance reviewers can inspect the audit trail

  # Good: extends browser-agent work into real desktop operations with local processing and team controls.
  # Bad: broad OS authority makes permission prompts, approvals, replay, and error recovery product-critical.
