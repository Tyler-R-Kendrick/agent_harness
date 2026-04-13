@agent-browser @documents @media
Feature: Active document and media surfaces
  Browser tabs and text-like workspace files open as active document surfaces. Media assets open
  as viewer or playback surfaces instead of text editors.

  Background:
    Given the agent browser is open
    And the active workspace is "Research"

  Scenario: Open a browser tab as an active document surface
    When the user opens the "Hugging Face" browser tab from the workspace tree
    Then the "Page overlay" surface is visible
    And the address field shows "https://huggingface.co/models?library=transformers.js"
    When the user closes the page overlay
    Then the chat panel becomes visible again

  Scenario: Open a workspace file as an editable document surface
    Given the active workspace contains the file ".agents/hooks/test-hook.sh"
    When the user opens that workspace file from the workspace tree
    Then the file editor opens in the main content area
    And the "Workspace file path" field shows ".agents/hooks/test-hook.sh"
    When the user edits the file and saves it
    Then the file remains attached to the active workspace

  @product-contract
  Scenario: Open media assets as viewer or playback surfaces
    Given the active workspace contains an audio, PDF, DOCX, image, or video asset
    When the user opens the asset from the workspace tree
    Then the main content area shows a viewer or playback surface for that asset
    And the asset does not open in the text file editor
    And the asset is not treated as an editable document surface