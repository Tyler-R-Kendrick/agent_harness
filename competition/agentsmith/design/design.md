# AgentSmith Design

## Look And Feel

- AgentSmith uses a clean consumer SaaS landing page with plain claims, browser logos, use-case sections, pricing cards, and FAQ.
- The tone is direct and non-technical: "for people who hate repetitive work", "install in 10 seconds", and "no account required".
- Several product screenshot slots were still marked "Screenshot coming soon" at snapshot time, which weakens design proof.
- The pricing section is unusually understandable for this category because it describes actions instead of opaque credits.

## Design Tokens Observed

```yaml
visual_language:
  mode: consumer productivity SaaS
  surfaces: use-case cards, pricing cards, FAQ, browser compatibility badges
  information_density: low_to_medium
  trust_language: free forever, no account, local extension, no credit card
interaction_patterns:
  primary_action: install Chrome extension
  secondary_actions:
    - save workflow
    - export CSV or JSON
    - connect MCP
  pricing_unit: browser actions
```

## Differentiators

- The design makes automation approachable for non-developers through examples: lead research, price monitoring, job applications, and product-listing extraction.
- The no-account install claim is a strong adoption wedge against heavier browser-agent platforms.
- The action-based pricing model is easier to reason about than tokens, ACUs, or opaque credits.
- MCP is framed as optional power-user functionality, so ordinary users are not forced through developer setup.

## Where It Breaks Down

- Missing screenshots create a gap between marketing promise and visible product proof.
- "No setup" and "local extension" claims are reassuring, but users still need to understand what a browser agent can read and click.
- Saved workflow replay is paywalled behind Pro, which may limit trial of the most durable feature.
- Action quotas are clearer than credits, but long workflows can still create anxiety if every click, navigation, or extraction consumes budget.

## Sources

- https://agentsmith.so/
