# Marketplace MCPs, Modes, And On-Demand Skills

- Harness: Roo Code
- Sourced: 2026-05-09

## What it is
Roo combines a built-in marketplace for MCPs and modes with a skills system that loads workflow-specific instructions only when a matching task appears.

## Evidence
- Official docs: [Roo Code Marketplace](https://docs.roocode.com/features/marketplace)
- Official docs: [Skills](https://docs.roocode.com/features/skills)
- Official docs: [Model Context Protocol (MCP)](https://docs.roocode.com/features/mcp/overview)
- First-party details:
  - the marketplace is a central hub for discovering and installing community-contributed MCPs and modes
  - installations can be scoped to a project or globally
  - Roo skills package instructions plus bundled assets such as scripts, templates, and references
  - skills are loaded on demand instead of bloating the base prompt
  - MCP is documented as the standard way to extend Roo with external tools and resources
- Latest development checkpoint:
  - Roo's current docs present marketplace installs, MCP connectivity, and skills as one coherent extensibility stack rather than as isolated power-user features

## Product signal
Roo is pushing a package-based workflow model where tools, modes, and domain-specific instructions can all be reused and shared without forking the core harness.
