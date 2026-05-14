Feature: Sema4.ai Python automation as AI actions
  Sema4.ai differentiates by making Python automation callable by agents while preserving Robocorp deployment tooling.

  Scenario: Expose a Python function as an AI action
    Given a developer has a Python automation script
    When they add Action Server metadata and start the server
    Then the script is exposed as an OpenAPI-compatible action
    And an AI agent can call it with an authorization key

  Scenario: Build and debug automation from VS Code
    Given a developer uses the Sema4.ai VS Code extension
    When they create, run, and debug a robot
    Then they can inspect browser and desktop UI elements
    And publish the automation to Control Room

  Scenario: Deploy an agent with operator-controlled runtime config
    Given an AI operator manages production deployment
    When they configure workspaces, LLM connections, and secrets
    Then the agent package can run without embedding sensitive deployment details

  # Good: code-first action exposure is clean and composable.
  # Bad: brand/toolchain transition can make the product feel fragmented.
