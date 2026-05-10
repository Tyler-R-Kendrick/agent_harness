# MCP Server Builds And Updates Workflows

- Harness: n8n
- Sourced: 2026-05-10

## What it is
n8n's built-in MCP server now lets external agent clients create, edit, validate, test, and iterate workflows directly inside an n8n instance.

## Evidence
- Official blog: [Build and Update Workflows with n8n's MCP Server](https://blog.n8n.io/n8n-mcp-server/)
- Official docs: [Accessing and using n8n MCP server](https://docs.n8n.io/advanced-ai/mcp/accessing-n8n-mcp-server/)
- Official docs: [n8n MCP server tools reference](https://docs.n8n.io/advanced-ai/mcp/mcp_tools_reference/)
- First-party details:
  - the April 29, 2026 update moved the MCP server from execute-only behavior to create and edit workflow support
  - n8n says the client flow commonly generates a workflow, validates it, executes it, reads failures, and retries
  - instance-level MCP access exposes workflow search, test execution, workflow updates, and data-table operations
  - n8n positions the server as first-party and built into Cloud, Enterprise, and Community Edition deployments
- Latest development checkpoint:
  - as of April 29, 2026, n8n recommends version `2.18.4` or higher for the workflow-building MCP flow

## Product signal
n8n is making its automation runtime directly programmable by other agent harnesses, which turns it into both a competitor and a substrate.
