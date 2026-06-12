Feature: OpenClaw always-on personal assistant workflows
  OpenClaw differentiates by turning local devices and messaging channels into an always-available agent runtime.

  Scenario: Ask the assistant from a messaging channel
    Given a user has OpenClaw Gateway running on a device they control
    And a messaging channel such as Telegram, Slack, Discord, or iMessage is connected
    When the user sends the assistant a task
    Then OpenClaw receives the message through the channel
    And runs an agent turn through the local Gateway
    And replies in the same channel

  Scenario: Use a live Canvas for controllable output
    Given a task needs more than a text reply
    When OpenClaw renders a live Canvas
    Then the user can inspect or control the assistant's visual output
    And the assistant can move beyond a pure chat transcript

  Scenario: Extend the assistant with skills
    Given a user installs a skill or plugin
    When OpenClaw invokes that capability during a task
    Then the assistant can interact with local resources or external services
    And the user's effective automation surface expands

  # Good: makes personal automation ambient through existing communication channels.
  # Bad: third-party skills and local execution turn provenance, sandboxing, and review into product-critical UX.
