# LaVague Design

## Look And Feel

- Open-source framework brand with a simple landing page, code snippets, community links, and a documentation-led funnel.
- The visual identity is softer and more community-oriented than browser-infrastructure vendors; the surface is closer to a research/open-source project than a polished SaaS dashboard.
- The product is split between framework builders and QA engineers, with LaVague QA presented as a more packaged workflow.

## Design Tokens To Track

```yaml
surface: open-source docs and QA CLI
accent: community framework with code samples
primary_control: pip install lavague or lavague-qa
core_objects:
  - WebAgent
  - World Model
  - Action Engine
  - Selenium driver
  - Playwright driver
  - Chrome extension driver
  - Gherkin feature
  - generated Pytest file
  - TokenCounter
information_density: medium
agent_contract:
  - objective
  - current web page state
  - generated instructions
  - compiled Selenium or Playwright code
```

## Differentiators

- LaVague makes the planner/executor split explicit: a World Model produces instructions and an Action Engine compiles them into browser action code.
- LaVague QA directly bridges BDD artifacts to executable tests by taking Gherkin scenarios and generating Pytest/Selenium.
- The docs expose token counting and cost estimation as a first-class concern, which is stronger than many browser-agent frameworks.

## What Is Good

- The architecture is legible for developers who want to swap models, drivers, and contexts.
- QA positioning is concrete: start from a URL and `.feature` file, run the agent, generate tests, then run Pytest.
- The framework supports Selenium, Playwright, and Chrome extension drivers, though not with equal feature parity.

## Where It Breaks Down

- The QA docs explicitly say the tool is still an early release and may contain bugs.
- Generated tests still need human review; the docs warn that full accuracy is not guaranteed.
- The driver support matrix has gaps, including coming-soon or unsupported features in Playwright and Chrome extension paths.
- Telemetry is collected by default unless users opt out, which raises privacy and enterprise-readiness questions.

## Screenshot References

- Homepage and framework positioning: `https://www.lavague.ai/`
- GitHub README and architecture: `https://github.com/lavague-ai/LaVague`
- QA usage: `https://docs.lavague.ai/en/latest/docs/lavague-qa/usage/`
