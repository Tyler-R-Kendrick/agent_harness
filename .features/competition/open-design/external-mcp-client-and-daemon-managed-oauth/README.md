# External Mcp Client And Daemon Managed Oauth

- Harness: Open Design
- Sourced: 2026-05-13

## What it is
Open Design now acts as both an MCP server and an MCP client, with daemon-managed OAuth and design-oriented server templates for bringing external tools into the design workflow.

## Evidence
- Official release notes: [Open Design 0.6.0](https://github.com/nexu-io/open-design/releases)
- First-party details:
  - the `0.6.0` release says Open Design ships an external MCP client with daemon-managed OAuth
  - the same release says the product now includes 39 design-focused templates for external MCP integrations
  - the notes describe the platform as fully bidirectional because it already ships its own MCP server and can now also consume external MCP servers
  - reconnect handling preserves OAuth state and advertised tool counts
- Latest development checkpoint:
  - the May 9, 2026 `0.6.0` release is the first strong signal that Open Design is moving beyond internal skills into a broader tool ecosystem with first-class auth handling

## Product signal
Open Design is shifting from a closed design loop toward a governed external-tool surface where integrations can become part of the same artifact workflow.
