# Notte Design

## Look And Feel

- High-polish developer platform design with a dark, futuristic marketing surface and a docs surface organized around sessions, agents, functions, scraping, vaults, identities, and studio.
- The home page leans into "agentic internet" language and shows platform primitives as a complete stack rather than isolated APIs.
- Docs use concise concept pages and code-first quickstarts that encourage Python or JavaScript SDK adoption.

## Design Tokens To Track

```yaml
surface: marketing site, docs, console, studio
accent: agentic internet, speed, reliability, global edge, full-stack platform
primary_control: create session, observe, execute, scrape, run agent, deploy function
core_objects:
  - session
  - observation
  - action
  - agent
  - function
  - vault
  - identity
  - profile
  - recording
builder_surfaces:
  - agent builder
  - demonstrate mode
  - studio
trust_controls:
  - encrypted vaults
  - scoped secrets
  - profiles
  - personas
  - session lifecycle context managers
```

## Differentiators

- Notte's perception layer turns webpages into an action API, reducing the amount of raw page interpretation the model must perform.
- It treats authentication as a product category: vaults, identities, email/phone, OTP, 2FA, and session profiles are prominent.
- Serverless browser functions let teams convert repeated agent workflows into API endpoints colocated with browser infrastructure.
- Demonstrate Mode and Studio point toward a workflow-builder experience, not just SDK usage.

## What Is Good

- The platform gives developers a clear progression: start with a session, observe/execute actions, run an agent, then promote stable work into functions.
- The docs explicitly compare agents with scripted automation, including tradeoffs around speed, cost, reliability, and page variability.
- Vaults avoid exposing secrets to LLM calls, which is a strong trust and enterprise-design signal.

## Where It Breaks Down

- The marketing is assertive and benchmark-heavy; buyers may need independent validation before trusting speed and reliability claims.
- A "complete stack" can become platform lock-in if functions, vaults, identities, and studio are all adopted together.
- The product is developer/platform oriented, so it does not directly solve the human-facing browser workspace problem.

## Screenshot And Open Design References

- Marketing surface and plan cards: https://www.notte.cc/
- Platform concept map: https://docs.notte.cc/concepts
- Session and agent docs: https://docs.notte.cc/concepts/sessions and https://docs.notte.cc/concepts/agents
