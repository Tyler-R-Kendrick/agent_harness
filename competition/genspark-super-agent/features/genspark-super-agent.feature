Feature: Genspark no-code Super Agent
  Genspark differentiates by turning one prompt into polished cross-format deliverables rather than exposing low-level browser-agent mechanics.

  Scenario: Produce a research briefing and slides
    Given a user opens Genspark
    When the user asks Super Agent to research a market and create a slide deck
    Then Genspark plans the work
    And coordinates research and slide-generation agents
    And returns a shareable deck or generated page

  Scenario: Complete a real-world phone task
    Given a user needs to call a business
    When the user delegates the call to Super Agent
    Then Genspark uses a voice agent to hold the conversation
    And returns the result of the call to the user

  Scenario: Route work across specialized agents
    Given a task requires data analysis, writing, and design
    When Super Agent decomposes the request
    Then it assigns specialized agents to the relevant deliverables
    And combines the outputs into a single task result

  # Good: excellent artifact-first UX for broad everyday work.
  # Bad: users may not get enough browser-level evidence for critical workflows.
