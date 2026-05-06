# Browser Use Cloud Design

## Look And Feel

- Documentation-first developer UX with quickstart code, API objects, and pricing tables.
- The product model is organized around three approaches: AI Agent, Direct Browser Control, and Skills.
- The design emphasizes "choose the right abstraction" rather than one monolithic agent.

## Design Tokens To Track

```yaml
surface: developer docs and cloud dashboard
accent: clean SaaS documentation styling
primary_control: SDK run/create calls
core_objects:
  - task
  - session
  - browser
  - profile
  - skill
  - file
automation_modes:
  - natural-language agent
  - CDP browser session
  - deterministic skill endpoint
information_density: high
```

## Differentiators

- Skills convert a demonstrated/browser-agent task into a repeatable API endpoint.
- Direct Browser Control keeps Playwright/Puppeteer/Selenium-compatible escape hatches.
- Pricing is granular: task init, per-step model cost, browser session time, skill creation/execution, proxy data.

## What Is Good

- The three-mode model is clear and maps to different reliability needs.
- Skills acknowledge that repeated work should become deterministic instead of always rerunning an LLM agent.
- Open-source Browser Use creates developer credibility and distribution.

## Where It Breaks Down

- Pricing complexity can make simple tasks hard to estimate.
- The cloud docs and open-source docs can fragment the mental model.
- Users must understand when to use agent vs raw browser vs skill.

## Screenshot References

- Cloud quickstart and dashboard flow: `https://docs.browser-use.com/cloud/quickstart`
- Pricing tables: `https://docs.browser-use.com/pricing`

