# Firecrawl Gossip

## Positive Signals

- Firecrawl reports large public adoption: more than one million users, broad MCP installs, and a large open-source GitHub presence.
- Developer discussion repeatedly praises the Markdown/structured-data output because it cuts context cleanup work for agents.
- The browser/interact launch gives Firecrawl a direct answer to "scrape is not enough when the page requires actions."

## Negative Signals

- Some public reviews and self-hosting guides call out that hosted-only capabilities matter: the self-hosted version does not fully match hosted `/agent` and `/browser` behavior.
- GitHub issue traffic shows the usual open-source/self-hosting operational pain: endpoint regressions, compose setup, and service dependencies.
- Reddit-style comparisons suggest Firecrawl is strong for clean context but less reliable than browser/proxy-heavy stacks for CAPTCHA-heavy or blocked sites.

## Bug And UX Risk Themes

- Credit accounting can become confusing when search, scrape, interact, advanced formats, and browser minutes all price differently.
- Clean Markdown can encourage agents to skip visual verification when the page state matters.
- Browser sessions are powerful but still infrastructure-oriented; users need separate approval and audit patterns for risky actions.

## Sources

- https://www.firecrawl.dev/
- https://docs.firecrawl.dev/features/browser
- https://www.firecrawl.dev/blog/firecrawl-101
- https://docs.firecrawl.dev/ai-onboarding
- https://github.com/firecrawl/firecrawl/issues/2139
- https://runwhatworks.com/blog/firecrawl-review
- https://www.reddit.com/r/codex/comments/1qw648e/firecrawl_for_ai_agents_skills_vs_mcp_servers_for/
