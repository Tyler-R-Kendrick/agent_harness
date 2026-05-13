# Nanobrowser Design

## Look And Feel

- Extension-first UX: a lightweight panel inside the user's existing Chrome-compatible browser.
- Marketing uses a compact open-source AI-agent pitch with GitHub proof, demo videos, and provider/model configuration.
- Product design appears utilitarian: task prompt, agent steps, browser actions, and settings for model/API routing.

## Design Tokens To Track

```yaml
surface: browser extension side panel
accent: open-source developer branding with simple AI/browser cues
primary_control: task prompt in extension panel
secondary_controls:
  - model provider configuration
  - agent execution status
  - browser tab context
  - task history or logs
trust_controls:
  - open-source repository
  - BYOK model setup
  - runs in existing browser profile
information_density: medium
```

## Differentiators

- It does not ask users to switch browsers; it adds agents to the browser they already use.
- Open-source code and BYOK setup create a privacy/control counter-position to hosted agents.
- Multi-agent phrasing makes it feel more capable than a single sidecar assistant.

## What Is Good

- Installation friction is lower than a full browser fork.
- Real profile access helps with authenticated sites, 2FA handoff, and user context.
- GitHub visibility makes bugs and roadmap pressure easy to inspect.

## Where It Breaks Down

- Extension permissions and real-profile automation increase trust burden.
- BYOK/model configuration is harder for nontechnical users than a bundled assistant.
- Chrome extension constraints can limit reliability compared with a controlled browser runtime.

## Screenshot References

- Product site: `https://nanobrowser.ai/`
- GitHub README and assets: `https://github.com/nanobrowser/nanobrowser`
