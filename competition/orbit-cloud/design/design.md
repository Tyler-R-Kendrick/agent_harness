# Orbit Cloud Design

## Look And Feel

- Enterprise builder landing page with a calm cloud-runtime layout: local development, deploy, monitor.
- The design emphasizes operational guardrails more than agent magic: runtime parity, auth, orchestration, observability, autoscaling, RBAC, audit trails, and deployment models.
- Pricing is deliberately sales-led, asking for volume, region, and requirement details.

## Design Tokens To Track

```yaml
surface: enterprise cloud runtime landing page
accent: professional B2B automation
primary_control: talk to us
core_objects:
  - Orbit desktop app
  - cloud browser
  - flow
  - webhook
  - schedule
  - run artifact
  - tenant quota
information_density: medium
enterprise_controls:
  - RBAC
  - scoped tokens
  - audit trails
  - VPC deployment
```

## Differentiators

- Bridges desktop/local development and cloud deployment with the same browser engine.
- Supports CDP, Playwright, Selenium, headful/headless execution, retries, backoff, webhooks, schedules, and tenant controls.
- Makes observability a first-class product point: structured logs, traces, screenshots, artifacts, and searchable audit trails.

## What Is Good

- The local-to-cloud story solves a real workflow gap: prototype against real sites, then operate the same automation in production.
- Enterprise controls are easy to understand and relevant to regulated browser automation.
- It treats auth and 2FA as operational design problems instead of afterthoughts.

## Where It Breaks Down

- Sales-led pricing slows self-serve developer adoption.
- The page is high-level; buyers need docs or demos to judge how much is framework versus managed browser capacity.
- Broad enterprise language risks hiding the concrete browser evidence users need during a single failed run.

## Screenshot References

- Cloud product page: `https://www.olostep.com/orbit/cloud`
