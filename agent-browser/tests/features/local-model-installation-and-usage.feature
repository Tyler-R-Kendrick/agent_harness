@agent-browser @local-models
Feature: Local model installation and usage
  Browser-runnable ONNX models can be discovered in Settings, installed for local inference,
  and selected from the chat composer.

  Background:
    Given the agent browser is open
    And the active workspace is "Research"

  Scenario: Search and filter browser-runnable ONNX models
    When the user opens "Settings"
    Then the "Hugging Face search" field is visible
    And no model task filters are selected
    When the user enables the "Text Generation" task filter
    Then the registry request is limited to text-generation models

  Scenario: Install a local model from the registry
    Given the local model registry returns the "gpt2" model as browser-runnable and ONNX-backed
    When the user opens "Settings"
    And the user loads the "gpt2" model card
    Then the model card enters a loading state
    And the model card eventually shows "Installed"

  Scenario: Use an installed model from the chat composer
    Given the "gpt2" model is installed for local inference
    When the user returns to the chat panel
    And the user selects "gpt2" from the installed model picker
    And the user sends "Summarize the workspace rules."
    Then the request includes the active workspace context
    And the assistant generates a response with the selected local model