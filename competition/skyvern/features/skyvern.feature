Feature: Skyvern browser workflow automation
  Skyvern differentiates by turning natural-language tasks into real browser runs with artifacts, persistent sessions, and reusable workflows.

  Scenario: Run a browser task from code
    Given a developer has a Skyvern API key
    And the developer provides a prompt and optional starting URL
    When the developer calls the run task API
    Then Skyvern creates a browser run
    And returns status, timestamps, output, failure state, screenshots, recordings, and an app URL

  Scenario: Debug a failed automation run
    Given a Skyvern task failed or timed out
    When the developer inspects the run status and timeline
    And opens the final screenshot or recording
    Then the developer can see where the browser stopped
    And can adjust the prompt, max steps, credentials, or workflow blocks

  Scenario: Reuse browser context across runs
    Given a workflow needs logged-in browser state
    When the developer runs a task with a browser_session_id or browser profile
    Then Skyvern can continue from persisted state
    And future runs can avoid repeating login steps

  Scenario: Publish a prompt task as a reusable workflow
    Given a task succeeds often enough to reuse
    When the developer enables workflow publishing
    Then the task can become a workflow primitive
    And future callers can invoke the repeatable workflow instead of rebuilding the run

  # Good: artifacts, failure states, and workflow publishing make agent runs inspectable.
  # Bad: self-hosted setup, provider keys, and browser infrastructure can overwhelm smaller teams.
