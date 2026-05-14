Feature: Notion turns workspace into an agent orchestration hub
  Notion now competes as an orchestration layer for agents, tools, and live business data inside one collaborative workspace.

  Scenario: Run custom logic inside Notion with Workers
    Given a team has repeatable automation logic that does not fit built-in Notion actions
    When they deploy code into Notion Workers
    Then the code runs in Notion's cloud sandbox
    And workflows can be triggered via webhooks and agent actions without separate infrastructure

  Scenario: Sync external databases into Notion-native operational views
    Given a team stores system-of-record data outside Notion
    When they connect API-accessible data sources through the Developer Platform
    Then Notion databases stay up to date with synced external records
    And agents can reason over that live data in workspace context

  Scenario: Coordinate first-party and external agents from one workspace
    Given a team already uses external coding or support agents
    When they connect partner or internal agents through Notion's external-agent interfaces
    Then users can assign work and monitor progress in Notion
    And external agents appear as operational teammates rather than disconnected tools

  Scenario: Feature diff vs Agent Browser
    Given both products support AI-assisted workflows
    When we compare Notion's May 13, 2026 launch to Agent Browser
    Then Notion leads on native no-code workspace database orchestration and embedded collaborator UX
    And Agent Browser leads on browser-native execution, local model installation, isolated per-workspace terminals/filesystems, and deterministic verification flows
    And both products now emphasize multi-agent coordination, but with different control surfaces (Notion workspace ops plane vs Agent Browser browser-runtime plane)

  # Good: strong wedge into enterprise ops by combining docs, databases, agents, and custom code where teams already collaborate.
  # Bad: credit economics, governance complexity, and reliability of cross-agent orchestration could become adoption friction.
