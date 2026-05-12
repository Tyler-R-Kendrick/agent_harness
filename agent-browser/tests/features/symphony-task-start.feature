Feature: Symphony task start
  Starting a task from the Symphony work queue should show visible progress instead of a stale preparing state.

  Scenario: New local task starts from the Symphony work queue
    Given the agent browser is open
    When the user opens "Symphony"
    And the user starts a Symphony workspace request "parallelize frontend, tests, and documentation work"
    And the user creates a Symphony task named "make a new widget"
    Then the Symphony work queue shows "make a new widget" as running
    And the Symphony task detail shows session phase "StreamingTurn"
    And the Symphony new task field is cleared
