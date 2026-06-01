# Chrome MCP Server Design

## Look And Feel

- Developer-first GitHub project surface with badges, bilingual documentation links, feature bullets, comparison tables, and installation snippets.
- The product UI is implied through the Chrome extension, Visual Editor, workflow recording, and agent-chat documentation rather than a polished marketing site.
- The design is practical and extensible: extension status, server connection, MCP endpoint, tools, semantic search, and visual editing are the core concepts.

## Design Tokens Observed

- Public-facing design is mostly GitHub markdown: badges, emoji bullets, tables, headings, and code blocks.
- Product surfaces use browser-extension and developer-tool conventions: connect/disconnect status, local server indicators, workflow recording, and page overlays.
- Visual Editor documentation frames the product as an in-page overlay that can edit pages while Claude Code or Codex streams tool use.

## What Differentiates It

- It combines local real-Chrome control with semantic search and browser-history/bookmark/network tooling, not just click/type/screenshot primitives.
- It advertises both streamable HTTP and local MCP usage, which makes it friendlier to multiple clients.
- The project has visible open-source traction, including thousands of stars and active issues, which makes it easier for developers to inspect and fork.

## What Is Good

- The README clearly explains why existing login state and user browser configuration matter compared with Playwright-launched browsers.
- The feature list maps well to actual agent needs: cross-tab context, screenshots, network monitoring, bookmarks, history, smart content extraction, and semantic tab discovery.
- Open-source documentation makes the architecture and roadmap more inspectable than closed beta products.

## Where It Breaks Down

- The public surface feels like an engineering project rather than a packaged agent-browser experience.
- Setup and connection health are a recurring UX risk because extension, native messaging, HTTP server, MCP client config, and browser state all have to line up.
- Security posture is mostly inherited from local execution and open source; the public surface does not foreground policy authoring, audit trails, redaction, or enterprise controls.

## Sources

- https://github.com/hangwin/mcp-chrome
- https://playbooks.com/mcp/hangwin-chrome
- https://deepwiki.com/hangwin/mcp-chrome
- https://github.com/hangwin/mcp-chrome/issues/181
