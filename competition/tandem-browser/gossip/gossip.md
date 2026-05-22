# Tandem Browser Gossip

## Positive Signals

- Public positioning maps directly to repeated community complaints that browser agents fail when they lack real sessions, MFA handoff, and human recovery.
- The product is transparent about development-preview status, platform support, and Windows signing limitations.
- The open-source and local-first stance gives Tandem credibility with users who are wary of sending logged-in browser activity to a cloud service.

## Negative Signals

- The product has to prove that many MCP tools and browser endpoints remain understandable, permissioned, and debuggable in daily use.
- Windows SmartScreen warnings can cause ordinary users to abandon install before seeing the product.
- The design's dense explanatory style may appeal to developers but underserve non-technical operators.

## Category Chatter

- Browser-agent discussions increasingly say that MFA, CAPTCHA, anti-bot systems, and brittle new profiles break demos unless a real stable browser and human handoff exist.
- MCP browser builders are experimenting with native browsers, extension bridges, and LLM fallback because plain selector clicking still fails on shadow DOM and dynamic classes.
- Security discussions continue to warn that any same-session browser agent needs clear boundaries around cookies, storage, secrets, and injected page content.

## Bug And UX Risks To Watch

- Multi-agent control can create tab contention or surprising actions if locks and ownership are not visible.
- Agent-facing network and DOM access can leak sensitive state without strong redaction and per-tool approvals.
- Human intervention should preserve replay evidence; otherwise "co-driving" becomes hard to audit after the task.

## Sources

- https://tandembrowser.org/
- https://www.reddit.com/r/mcp/comments/1s70fao/built_a_browser_with_a_native_mcp_server_and_llm/
- https://www.reddit.com/r/AI_Agents/comments/1subsl4/we_spent_3_months_building_an_ai_agent_for/
