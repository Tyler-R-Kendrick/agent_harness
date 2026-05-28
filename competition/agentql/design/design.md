# AgentQL Design

## Look And Feel

- AgentQL's product surface is documentation-led: the docs, query examples, debugger workflow, and pricing table are more important than a marketing splash.
- The design centers the query language itself. Braced examples, typed response shapes, and SDK snippets make the product feel like a developer primitive.
- The Chrome DevTools debugger flow is a strong UX choice because it lets users test and highlight queried elements on the live page before committing code.
- The pricing page is simple and usage-oriented: API calls, remote-browser hours, concurrency, and support levels.

## Design Tokens Observed

```yaml
visual_language:
  mode: developer_query_language
  tone: precise_and_documentation_first
  density: high
  proof_units:
    - api_calls
    - remote_browser_hours
    - concurrent_remote_browser_sessions
    - query_examples
interaction_patterns:
  primary_action: get_api_key
  secondary_action: explore_playground
  debugging_surface: chrome_devtools_extension
  core_abstractions:
    - query_data
    - query_elements
    - get_by_prompt
    - remote_browser
```

## Differentiators

- Natural-language element descriptions lower the cost of writing selectors for changing web pages.
- The debugger extension makes query iteration visible and concrete, which is better than asking developers to tune prompts blindly.
- The product works across scraping and automation, so a single semantic query model can locate elements, extract data, and drive clicks/fills.
- MCP, LangChain, LlamaIndex, Dify, and Zapier integration pages place AgentQL directly in agent-builder workflows.

## Where It Breaks Down

- Semantic queries can hide uncertainty. A query that returns the wrong matching element may look cleaner than a selector failure unless confidence and traces are exposed.
- The workflow still requires an API key and local setup, which may be more friction than pure in-browser extension agents for casual users.
- Remote-browser and API-call pricing can be harder to predict for long autonomous tasks than for fixed scraping scripts.
- AgentQL is not a complete evidence workbench; screenshots, replay, approvals, and cost history still need to be added by the consuming agent platform.

## Sources

- https://docs.agentql.com/quick-start
- https://docs.agentql.com/scraping
- https://docs.agentql.com/integrations/mcp
- https://www.agentql.com/pricing
