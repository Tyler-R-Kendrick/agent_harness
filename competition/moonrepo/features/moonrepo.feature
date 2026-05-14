Feature: moonrepo v2 capability map for agent-harness parity

  Scenario: Define parity target for WASM-capable toolchain registration
    Given moonrepo v2 emphasizes extensible and deterministic toolchain primitives
    When agent-harness defines a shared core tool API for all projects
    Then the API should support standards-based tool definitions
    And the API should register providers by id and capability metadata
    And providers should execute tools through a normalized runtime context
    And WASM providers should be supported through WASI-compatible interfaces
