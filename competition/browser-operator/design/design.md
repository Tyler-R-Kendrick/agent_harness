# Browser Operator Design

## Look And Feel

- Browser Operator presents as a full browser product rather than a thin MCP bridge.
- The visual identity is open-source product marketing plus a desktop-browser workflow: download buttons, provider setup, agent conversation, and visible browser automation.
- The docs keep onboarding concrete: choose a model provider, save credentials, then ask the browser agent to search or research.
- The app design leans on a chat assistant inside a Chromium-based browser, with named modes such as Search Agent and Research Agent.

## Design Tokens To Track

```yaml
surface: chromium-desktop-browser-with-agent-chat
accent: local-privacy-and-open-source-control
primary_control: conversational-agent-prompt
core_objects:
  - chromium-browser
  - search-agent
  - research-agent
  - model-provider
  - local-memory
  - browser-task
information_density: medium
trust_posture: local-browser-with-user-supplied-provider-credentials
```

## Differentiators

- It competes as an installable AI browser, not only a developer library or remote session provider.
- Provider choice is a core design object: OpenRouter, OpenAI, Groq, and LiteLLM/local model setup are visible in onboarding.
- The product encourages users to watch the browser work in real time, which is more legible than an opaque background job.
- The open-source desktop-browser framing captures users who want the AI browser pattern without committing to a model-owner browser.

## What Is Good

- The mental model is simple for consumers: download a browser, pick an AI provider, start chatting.
- Local execution and open-source distribution are easy trust signals for users skeptical of hosted agent browsers.
- Research examples make the product feel useful for knowledge work, not just toy navigation.
- Provider flexibility can reduce lock-in and lets advanced users route through LiteLLM or local models.

## Where It Breaks Down

- The setup still asks users to reason about AI providers, API keys, hosted aggregators, and local model proxies.
- Cross-platform coverage is incomplete if Linux support remains an open request.
- A browser-level agent with local file or component-server access needs extremely clear permission and audit UX; public security issues make that expectation sharper.
- The product risks becoming a broad AI browser before its evidence, recovery, and policy surfaces feel mature.

## Screenshot References

- GitHub README hero and release imagery: `https://github.com/BrowserOperator/browser-operator-core`
- Getting started examples and provider setup: `https://docs.browseroperator.io/getting-started/`
