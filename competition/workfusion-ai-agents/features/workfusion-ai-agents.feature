Feature: WorkFusion vertical AI agents for financial crime compliance
  WorkFusion differentiates by packaging domain-specific AI agents that perform analyst-like FCC work.

  Scenario: Auto-adjudicate sanctions screening alerts
    Given a bank receives high-volume sanctions or watchlist alerts
    When WorkFusion's AI agent reviews the alert
    Then it can determine likely false positives
    And route remaining cases for human review with supporting evidence

  Scenario: Investigate adverse media
    Given an FCC team needs to review names against news sources
    When the adverse media AI agent collects and analyzes articles
    Then it prioritizes relevant findings
    And creates a human-in-the-loop review step for analyst signoff

  Scenario: Reduce manual Level 1 analyst load
    Given a financial institution has repetitive Level 1 FCC investigations
    When WorkFusion deploys prebuilt AI agents
    Then a meaningful share of alerts can be handled automatically
    And analysts focus on higher-risk cases

  # Good: domain packaging and measurable compliance value are strong.
  # Bad: less flexible for general browser-agent work outside FCC.
