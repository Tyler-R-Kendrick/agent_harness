Feature: Ui.Vision visual browser and desktop automation
  Ui.Vision RPA differentiates by combining Selenium-style browser macros with local computer vision, OCR, and native desktop control.

  Scenario: Record and replay a browser macro
    Given a user needs to repeat a browser workflow
    When they record or assemble Selenium-style commands in Ui.Vision
    Then the macro can replay clicks, typing, extraction, loops, and CSV operations
    And the user can run the macro from the extension or command line

  Scenario: Click by image or OCR text
    Given a target page or desktop app does not expose stable DOM selectors
    When the user adds XClick or OCR text commands
    Then Ui.Vision takes screenshots and finds visual targets locally
    And the automation can interact with web, PDF, image, video, Citrix, or desktop surfaces

  Scenario: Extend browser automation with native XModules
    Given a workflow needs file access, real mouse events, keyboard events, or desktop automation
    When the user installs the Ui.Vision XModules package
    Then the extension gains native OS-level capabilities
    And the same macro model can span browser and desktop steps

  # Good: explicit macros, local OCR, and desktop modules make the runtime understandable and broad.
  # Bad: setup, visual brittleness, and command density make it feel dated beside modern agent workbenches.
