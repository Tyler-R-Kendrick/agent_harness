# Magnitude Marketing

## Audience

- Developers building browser agents, automated workflows, and AI-assisted UI tests.
- Teams that want browser automation resilient to selector churn without adopting a hosted browser platform.
- Open-source and model-customization buyers who prefer bringing their own LLM and browser configuration.

## Positioning

- Core claim: open-source, vision-first browser agent.
- Market frame: browser automation breaks when selectors and DOM structure change; a vision model can interact more like a human.
- Product promise: navigate pages, perform actions, extract structured data, and verify UI behavior through a compact TypeScript API.

## Customer Model

- Open-source adoption through GitHub, docs, quickstarts, and community.
- The visible funnel is developer self-service rather than enterprise procurement or a metered hosted-browser SaaS.
- Users still pay their model provider and any browser infrastructure they choose to run.

## Who They Capture

- Developers who already know Playwright or TypeScript and want AI action primitives.
- QA and automation engineers testing high-churn UIs.
- Agent builders who want to benchmark vision-first action selection without committing to a full workspace.

## Who They Miss

- Nontechnical users who need a browser application, not an SDK.
- Compliance-heavy teams that need approvals, role controls, audit logs, and durable run artifacts out of the box.
- Teams that prefer cheap deterministic selectors for stable, owned UIs.

## Competitive Read

Magnitude pressures `agent-browser` at the developer API layer. Its wedge is "vision-first and easy to embed." `agent-browser` should answer with stronger inspectability: screenshots, traces, approvals, local state boundaries, and deterministic regression artifacts around every browser run.
