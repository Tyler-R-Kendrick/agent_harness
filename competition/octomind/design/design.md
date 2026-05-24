# Octomind Design

## Look And Feel

- QA SaaS surface with a crisp product-led layout, simple pricing cards, proof metrics, customer quotes, and dashboard screenshots.
- The design emphasizes stability and reassurance: passed/failed charts, traces, logs, screenshots, visual diffs, and self-healing maintenance.
- It feels operational rather than magical; the strongest surfaces are run history, debugging, and maintenance review.

## Design Tokens To Track

```yaml
surface: marketing site, dashboard, visual editor, recorder, CI reports, trace viewer
primary_objects:
  - test case
  - test run
  - project_url
  - selector
  - trace
  - screenshot
  - visual_diff
  - auto_fix
  - cloud_run
  - private_worker
core_controls:
  - create test visually
  - record flow
  - prompt test creation
  - run local or cloud
  - approve auto-fix
  - shard by tags
trust_controls:
  - SOC2
  - private location worker
  - source-level healing review
  - exportable Playwright code
```

## Differentiators

- It owns a clear vertical: not "browser agent for everything," but dependable AI-assisted E2E testing.
- Runtime context is central: Octomind sells browser traces, DOM snapshots, network logs, screenshots, and visual diffs as a reason it beats generic coding agents for tests.
- Source-level healing is a sharp design choice because fixes become durable Playwright selector changes instead of runtime guesswork.

## What Is Good

- The product aligns with team workflows: CI/CD, reports, private app access, TestRail/XRay style integrations, and reviewable maintenance.
- Visual failure history is easy for QA and product users to understand without reading raw logs.
- Pricing cards expose limits such as test cases, runs, parallelism, projects, and AI-created tests.

## Where It Breaks Down

- AI self-healing can create false confidence if healed selectors preserve green tests while missing changed business intent.
- It is less useful for exploratory browser tasks outside QA.
- Teams with mature Playwright suites may see it as another platform layer unless export/repo ownership stays clean.

## Screenshot And Design Studio References

- Product and dashboard screenshots: https://www.octomind.dev/
- Parallel execution/private worker: https://octomind.dev/product/run-e2e-tests
- Self-healing selector workflow: https://octomind.dev/product/playwright-self-healing/
