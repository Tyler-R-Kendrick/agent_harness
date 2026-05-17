# Zapier Agents Design

## Look And Feel

- Assistant-builder surface layered on top of Zapier's familiar app-automation UI.
- Agents are configured with instructions, app connections, actions, triggers, and knowledge sources.
- The design emphasizes delegation to "AI teammates" rather than a browser or terminal workbench.

## Design Tokens To Track

```yaml
surface: form-driven agent builder with app connection panels
accent: Zapier orange with clean SaaS cards
primary_control: natural-language agent instructions
secondary_controls:
  - app connections
  - actions
  - knowledge sources
  - Zapier Copilot edits
  - sharing controls
trust_controls:
  - connected-app permissions
  - activity and message limits
  - knowledge source scoping
information_density: medium
```

## Differentiators

- Zapier's integration catalog is the product's moat: agents can use thousands of app actions that buyers already trust.
- Knowledge sources and search actions let agents answer from connected business data without scraping pages manually.
- Zapier Copilot assists with building and modifying agents, reducing setup friction for non-technical users.

## What Is Good

- Very strong distribution among small businesses and operations teams that already use Zapier.
- App actions can be more reliable than browser clicks when the needed SaaS operations are exposed through integrations.
- Knowledge-source setup provides a clear mental model for what the agent can know.

## Where It Breaks Down

- Usage is measured through activities and plan limits, which can make exploratory agents feel costly or constrained.
- Product docs note that app/action restrictions may not fully carry into Zapier Agents in every enterprise scenario.
- Browser-only workflows, visual validation, CAPTCHA, and logged-in page state are outside the core value proposition.

## Screenshot References

- Agents product page: `https://zapier.com/agents`
- Build docs: `https://help.zapier.com/hc/en-us/articles/24393442652557-Build-an-agent-in-Zapier-Agents`
- Knowledge source docs: `https://help.zapier.com/hc/en-us/articles/24569690575117-Add-your-own-data-to-an-agent`
