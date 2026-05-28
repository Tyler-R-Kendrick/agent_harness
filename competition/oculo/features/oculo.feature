Feature: Oculo MCP-native AI browser
  Oculo differentiates by packaging browser-agent control, compact perception, and daily browsing into one local Chromium app.

  Scenario: Describe a page with minimal token budget
    Given an MCP client is connected to Oculo
    When the client calls the page tool
    Then Oculo returns a compact description of the current page
    And the agent avoids sending a full DOM or screenshot on every step

  Scenario: Execute browser work through explicit MCP tools
    Given an agent needs to browse, click, fill, research, translate, or extract data
    When it calls Oculo tools such as act, fill, read, run, tabs, research, preview, translate, or lens
    Then Oculo performs the browser action in the local app
    And the permission tier can auto-allow, notify, confirm, or block the action

  Scenario: Use Oculo as a normal browser
    Given a user wants AI capabilities without leaving their daily browser surface
    When they browse with tabs, bookmarks, history, downloads, split view, and the AI chat panel
    Then AI assistance remains available without turning every task into a separate automation session

  # Good: token-minimal perception and explicit permissions are easy to understand.
  # Bad: broad tool categories need strong defaults so a local browser does not become an overpowered agent shell.
