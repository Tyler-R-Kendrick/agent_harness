Feature: Manus delegated browser work
  Manus differentiates by letting users delegate multi-step work to either a cloud browser or an authorized local browser with existing logins.

  Scenario: Authorize a local browser session
    Given a user has installed Manus Browser Operator
    And the user is logged into a SaaS tool in Chrome
    When the user asks Manus to complete an authenticated workflow
    Then Manus asks for permission to control the browser
    And Manus works in a dedicated tab using the existing login
    And the user can stop the task by taking over or closing the tab

  Scenario: Reuse a preferred browser for recurring automation
    Given a user has configured a preferred Chrome browser
    When the user starts a My Browser session from another computer
    Then Manus can route the web task to the authorized browser environment
    And the workflow can reuse the account state and extensions already present there

  Scenario: Create tasks through the API
    Given a developer has a Manus API key
    When the developer creates an agent task through the API
    Then Manus returns a task identifier
    And the external system can track the task outside the consumer UI

  # Good: logged-in local browser operation attacks a major cloud-agent reliability gap.
  # Bad: credit burn, task failure recovery, and over-trusting action logs can still create review burden.
