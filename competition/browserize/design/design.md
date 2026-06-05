# Browserize Design

## Look And Feel

- Developer-infrastructure landing page with a dark technical hero, metric tiles, feature sections, pricing cards, and a code-oriented Playwright MCP integration example.
- The first viewport names the product as an "AI-First Web Browser" and immediately explains the stack: virtual browsers, MCP, CDP, and NoVNC.
- Visual hierarchy is built around infrastructure readiness rather than a user-facing browser workspace: "Virtual Browser Ready", protocol labels, uptime/deploy-time numbers, and hourly price cues.

## Design Tokens To Track

```yaml
surface: developer SaaS landing page and infrastructure console promise
accent: dark technical background with blue/purple protocol highlights
primary_control: deploy or connect a virtual browser
core_objects:
  - virtual browser instance
  - MCP endpoint
  - CDP endpoint
  - NoVNC viewer
  - hourly compute usage
  - Playwright MCP connection
information_density: medium
pricing_signal: "$0.10/hour pay-as-you-go"
```

## Differentiators

- Packages MCP, CDP, and NoVNC as a ready browser stack instead of asking the user to assemble a cloud browser, Playwright server, and visual debugger.
- Low hourly price and free development hour create a utility-compute buying motion.
- NoVNC is a useful trust and debugging affordance because humans can watch or manually inspect a session rather than relying only on agent text.

## What Is Good

- The product explains its technical contract quickly: developers know which protocols they can connect to.
- Usage-based pricing is easy to reason about compared with opaque action-credit or agent-step pricing.
- The design keeps the promise narrow, which makes it easier to evaluate against local Playwright MCP, Browserbase, Browserless, or raw CDP.

## Where It Breaks Down

- The UI is mostly an infrastructure promise, not a workflow product. It does not show a durable run timeline, approvals, secrets model, replay library, or failure triage surface.
- Headline metrics such as uptime, teams, and browser hours need independent verification before they should be treated as market proof.
- A cheap virtual browser still leaves the hard agent work to the buyer: task planning, permission boundaries, logged-in state handling, prompt-injection defense, and evidence retention.

## Screenshot References

- Landing page hero, protocol cards, pricing cards, and integration snippet: `https://www.browserize.com/`
