# Chromeflow Gossip

## Positive Signals

- Reddit demos and launch posts show strong interest in real-session browser MCPs for Claude Code and Codex.
- Users repeatedly ask for Codex to control normal Chrome instead of headless or simulated browser environments.
- The creator publicly documents hardening work, including multi-instance MCP race fixes, reconnect behavior, shadow-DOM handling, and real-world task passes.

## Negative Signals

- The broader MCP browser-extension category has visible frustration around sessions dying, extensions disconnecting, and fragile ownership of tabs.
- Marketing examples such as prospecting and transcript mining are useful but can blur into spam, scraping, or terms-of-service risk.
- Local real-profile automation increases trust pressure: cookies, secrets, payment pages, and authenticated SaaS dashboards are directly in scope.

## Bug And UX Risk Themes

- Extension reconnection and multi-session races can break the first tool call if not handled.
- Browser-profile ownership can become ambiguous when multiple agents, ports, or Chrome windows are active.
- The product needs durable evidence beyond live visibility if users must review what happened after a long run.

## Sources

- `https://chromeflow.run/`
- `https://www.reddit.com/r/aiagents/comments/1tmhzlw/chromeflow_agentic_browser_mcp_that_drives_real/`
- `https://www.reddit.com/r/mcp/comments/1thujy7/update_chromeflow_v097_multiinstance_mcp_race_fix/`
- `https://www.reddit.com/r/mcp/comments/1tpwx0v/browser_mcp_for_claude_code_browserbase_vs_the/`
- `https://www.reddit.com/r/codex/comments/1r41igh/controlling_chrome_from_codex_a_la_claude_in/`
