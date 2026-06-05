# Agentic WorkFlow Design

## Look And Feel

- Extension-first product site with bright visual-workflow screenshots, node/template imagery, browser-local privacy claims, and marketplace/community cues.
- Documentation uses a clean docs shell with left navigation, search, node references, concepts, and explicit execution-graph diagrams.
- The design centers on a builder mental model: trigger, browser context, node actions, structured items, branches, and output.

## Design Tokens To Track

```yaml
surface: browser extension plus visual node-workflow builder
accent: light documentation shell with colorful workflow imagery
primary_control: install extension and build workflow
core_objects:
  - trigger
  - browser context
  - node
  - structured item
  - branch
  - loop
  - template
  - marketplace workflow
information_density: medium-high
privacy_signal: local browser execution unless an external AI or API node is configured
```

## Differentiators

- Runs inside the user's browser and can read or modify the live page context, which is a sharper wedge than API-only automation canvases.
- Visual node graph makes browser actions, data transforms, AI calls, and service calls inspectable at build time.
- Local-first privacy copy is clear: workflows run in the browser, with external transfer only when the user configures an HTTP, API, or AI service node.

## What Is Good

- The docs explain the automation model instead of just listing features. "Every workflow is a small execution graph" is a useful product concept.
- Node references and templates make the product learnable for non-coders while still giving technical users exact behavior.
- The product admits an important limitation: browser-local execution is not the right fit for always-on backend workflows.

## Where It Breaks Down

- The visual builder can become dense for long workflows, especially if browser actions, data mapping, API calls, and AI reasoning are all mixed in one canvas.
- Local execution means scheduled runs depend on an open browser and machine health.
- The design focuses on workflow construction more than post-run evidence: screenshots, replay, approvals, secret redaction, and regression artifacts are not as prominent as the node model.

## Screenshot References

- Product site workflow/template screenshots: `https://awflow.io/`
- Documentation shell and execution-graph diagram: `https://docs.awflow.io/`
