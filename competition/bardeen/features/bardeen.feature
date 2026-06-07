Feature: Bardeen browser playbooks
  Bardeen differentiates through browser-context playbooks that can be created from templates, prompts, or manual actions.

  Scenario: Create a playbook from a natural-language prompt
    Given a user is on a web page they want to automate
    When they open Bardeen and describe the desired workflow
    Then Bardeen generates a Playbook with suggested actions
    And the user reviews and configures inputs before running it

  Scenario: Start from a template catalog
    Given a user needs sales, recruiting, research, or productivity automation
    When they browse the template gallery by category
    Then they can pin a ready-made Playbook
    And adapt it to their connected apps and current page context

  Scenario: Trigger a page-specific automation from the context menu
    Given a user has an existing Playbook
    When they add a right-click trigger and choose where it appears
    Then the automation is available from the browser context menu
    And the user can run it without opening the extension panel

  # Good: page-native triggers and templates make browser automation approachable.
  # Bad: production use is credit-metered and depends on extension permissions, browser state, and site DOM stability.
