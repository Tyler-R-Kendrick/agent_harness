Feature: Browserbeam structured browser API
  Browserbeam differentiates by returning compact, actionable browser state for AI agents instead of raw HTML or a Playwright-only control channel.

  Scenario: Observe a page as structured state
    Given a developer creates a Browserbeam session for a URL
    When the page is loaded
    Then the response includes markdown, interactive elements, refs, forms, map hints, scroll state, and stability information
    And the agent can select an element by ref instead of guessing a selector from raw DOM

  Scenario: Execute steps and inspect the diff
    Given an agent has the latest page refs
    When it sends click, fill, extract, screenshot, or other steps to the act endpoint
    Then Browserbeam executes the ordered steps
    And returns fresh page state plus what changed after the action

  Scenario: Fail with usable recovery context
    Given an action fails during a browser workflow
    When Browserbeam stops execution
    Then the API returns the error alongside current page state
    And the agent can decide whether to retry, switch strategy, or close the session

  # Good: compact state, refs, diffs, and stability map well to trustworthy agent loops.
  # Bad: ref lifecycle and credit burn require careful orchestration when pages change quickly.
