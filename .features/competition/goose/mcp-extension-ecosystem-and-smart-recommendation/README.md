# MCP Extension Ecosystem And Smart Recommendation

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose treats MCP extensions as the main way to connect tools, data, and product surfaces, then layers discovery, malware checks, smart recommendation, and roots-aware workspace wiring on top.

## Evidence
- Official site: [goose home](https://goose-docs.ai/)
- Official docs: [Using Extensions](https://goose-docs.ai/docs/getting-started/using-extensions/)
- First-party details:
  - Goose advertises 70+ documented extensions and says any MCP server can be installed as a Goose extension.
  - The extension system supports built-in extensions, custom stdio extensions, remote Streamable HTTP extensions, and extensions running inside containers.
  - Goose documents automatic malware checks for external extensions before activation.
  - The product includes smart extension recommendation so it can suggest relevant extensions based on the current task.
  - MCP Roots support lets roots-aware extensions automatically see the current session working directory.
- Latest development checkpoint:
  - the current extension docs position MCP connectivity as a first-class product layer rather than an advanced power-user escape hatch

## Product signal
Goose is pushing beyond raw MCP compatibility toward an installable extension operating system with guardrails, discovery, and dynamic task-aware tool suggestion.
