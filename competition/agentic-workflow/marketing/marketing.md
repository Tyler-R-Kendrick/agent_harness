# Agentic WorkFlow Marketing

## Audience

- No-code and low-code automators who want browser-native workflows rather than server-only API automation.
- Chrome and Firefox users who care about local execution and page-context access.
- Technical operators who need visual nodes for scraping, form filling, page transformation, service calls, AI classification, and templates.

## Positioning

- Agentic WorkFlow positions itself as browser-native automation: workflows run in the browser and can operate on the live page.
- It contrasts against Zapier, Make, and n8n by emphasizing DOM/page access rather than server-side app connectors.
- The privacy message is direct: workflows execute locally unless the user configures an external AI or API node.

## Customer Model

- Free browser extension with community/template-led acquisition.
- Marketplace and template sharing can build network effects if enough useful flows exist.
- The docs and node reference suggest a self-serve user base rather than procurement-led enterprise sales.

## Who They Capture

- Operators whose tasks live in browser pages without reliable APIs.
- Users who want to inspect or edit the automation graph instead of trusting a black-box chat agent.
- Privacy-sensitive users who prefer local browser execution.

## Who They Miss

- Teams that need cloud-hosted, always-on schedules without leaving a browser open.
- Enterprises that need central governance, approval policy, and compliance retention.
- Developers who prefer code-first Playwright/CDP control over a visual node builder.

## Competitive Notes For agent-browser

- Agentic WorkFlow reinforces the local-context wedge: users want automation where their logged-in browser state already exists.
- `agent-browser` should make post-run evidence, permissions, and recovery clearer than a canvas-only workflow builder.
