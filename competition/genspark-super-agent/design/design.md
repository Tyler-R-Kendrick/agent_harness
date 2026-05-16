# Genspark Super Agent Design

## Look And Feel

- Genspark uses a central prompt box and sidebar "New" flow where Super Agent can be selected as an execution mode.
- The product leans into deliverable-first surfaces: Sparkpages, slides, sheets, docs, websites, videos, and phone-call outcomes rather than raw browser traces.
- Help content frames the agent as a coordinator of specialized agents and tools, not as a browser automation console.

## Design Tokens To Track

```yaml
surface: AI workspace, chat prompt, generated pages, slide/doc/sheet builders, voice calling
accent: no-code autonomous productivity
primary_control: describe a task in the central prompt
core_objects:
  - super agent task
  - sparkpage
  - slide deck
  - sheet
  - phone call
  - specialized agent
  - MCP integration
information_density: medium
```

## Differentiators

- The design hides orchestration complexity behind familiar output formats: pages, slides, spreadsheets, calls, and media.
- Marketing claims a hybrid system that combines many models, tools, and MCP integrations, making the UI feel like a broad workbench rather than a single browser agent.
- Phone-call automation gives Genspark a real-world action surface that browser-only products often do not cover.

## What Is Good

- The user starts from the desired deliverable instead of picking low-level browser actions.
- Specialized agents make complex tasks feel approachable to non-technical users.
- Sparkpages and slide outputs create shareable artifacts quickly, which helps marketing and perceived value.

## Where It Breaks Down

- Deliverable-first design can hide whether the underlying web work was actually complete or well-sourced.
- Heavy generated pages and media can be less ergonomic on small screens or in workflows that need precise audit trails.
- Broad "one prompt does it all" positioning risks overpromising when the workflow needs authenticated app state, deterministic replay, or domain expertise.

## Screenshot References

- Help Center Super Agent page: `https://www.genspark.ai/helpcenter`
- OpenAI customer story screenshots/video references: `https://openai.com/index/genspark/`
