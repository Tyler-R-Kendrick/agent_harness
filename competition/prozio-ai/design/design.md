# Prozio AI Design

## Look And Feel

- Marketing-first SaaS page with bright cards, feature sections, testimonials, pricing tables, and risk-reversal copy.
- Product language is broad and approachable: "Create AI Agents & Automate Web Based Tasks", "No Code, All AI", and "Smarter Web Automation Starts Here".
- Documentation explains a node workflow model around triggers, a Prozio Agent node, structured output, webhooks, HTTP requests, response nodes, variables, test runs, and scheduled or webhook-triggered automations.

## Design Tokens To Track

```yaml
surface: no-code automation dashboard plus browser-agent playground
accent: friendly SaaS gradients and high-contrast feature cards
primary_control: create automation or run playground
core_objects:
  - Prozio Agent node
  - automation run
  - playground run
  - browser profile
  - sensitive info
  - webhook trigger
  - structured output
  - test run
  - BYOK OpenAI key
information_density: medium
pricing_signal: monthly or yearly tiers with run quotas
```

## Differentiators

- Browser profiles preserve logins, cookies, and preferences, which directly targets the recurring authenticated-browser pain point.
- Sensitive-info handling claims to let agents use credentials without exposing raw values to the AI.
- Multiple-agent orchestration and webhook/API nodes move the product beyond a single prompt-runner toward repeatable automation workflows.
- BYOK OpenAI support gives users a clearer cost-control story than pure hidden-credit systems.

## What Is Good

- The docs provide a concrete first-agent walkthrough using a webhook trigger and product extraction scenario.
- Test mode and per-node responses make the workflow easier to debug than a single chat transcript.
- Pricing uses visible run and playground limits, so users can estimate whether they are blocked by saved automation runs or experimentation runs.

## Where It Breaks Down

- The marketing makes broad reliability claims such as execution accuracy and time saved that need independent evidence.
- Run quotas are understandable, but they can still create friction if a user burns playground runs while debugging brittle sites.
- The design does not foreground screenshots, video replay, action-by-action approvals, or audit retention, which are important when browser agents use saved profiles and sensitive data.

## Screenshot References

- Product feature, profile, sensitive-info, and orchestration sections: `https://prozio.ai/`
- Documentation workflow, nodes, variables, and test-run examples: `https://prozio.ai/documentation/`
- Pricing table and run-quota model: `https://prozio.ai/pricing/`
