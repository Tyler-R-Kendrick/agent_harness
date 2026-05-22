Feature: Tandem Browser shared human-agent browser
  Tandem Browser differentiates by making the daily browser itself the MCP-native agent runtime.

  Scenario: Let an agent work inside a real authenticated session
    Given a user is signed in to multiple SaaS applications in Tandem Browser
    When an MCP-capable agent connects to Tandem
    Then the agent can inspect tabs, accessibility structure, DOM, network state, and DevTools context
    And it operates in the same browser session the human can see and interrupt

  Scenario: Recover from ambiguous work with human help
    Given an agent encounters a CAPTCHA, MFA prompt, unclear form field, or judgment call
    When Tandem pauses and asks the user for help
    Then the user can click, type, or redirect the workflow
    And the agent resumes without losing browser context

  Scenario: Run multiple model clients against one browser workspace
    Given a user wants Claude, GPT, Gemini, OpenClaw, or a local model to use the browser
    When the clients connect through MCP, HTTP, or private network access
    Then each agent can receive browser context
    And tab locks reduce conflicting multi-agent control

  # Good: human handoff, local state, and real-session control are core product concepts.
  # Bad: broad tool authority and same-session cookies make permission design critical.
