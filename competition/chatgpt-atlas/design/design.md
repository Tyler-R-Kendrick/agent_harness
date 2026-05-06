# ChatGPT Atlas Design

## Look And Feel

- Clean Chromium-style browser chrome with ChatGPT as a first-class new-tab and side-panel surface.
- The visual language mirrors current ChatGPT: minimal white/dark surfaces, rounded controls, conversational prompts, and soft suggestion chips.
- OpenAI's launch page screenshots show a centered prompt-style address/search entry, contextual suggestions, incognito state, page visibility controls, and an agent sidebar beside active web content.

## Design Tokens To Track

```yaml
surface: neutral white/dark
accent: ChatGPT green/blue accents depending on account/theme state
primary_control: omnibox prompt window
secondary_control: Ask ChatGPT side panel
trust_controls:
  - page visibility toggle
  - incognito
  - logged-out agent mode
  - sensitive-site watch/pause states
information_density: low-to-medium
```

## Differentiators

- ChatGPT is not an extension; it is built into the browser's everyday flow.
- Browser memory and ChatGPT memory make the product feel personalized across sessions.
- Agent mode reports in the panel while using the current browsing context, which reduces context-copying friction.

## What Is Good

- The assistant placement is easy to understand: page on one side, assistant on the other.
- Permission framing is visible: OpenAI repeatedly emphasizes page visibility, memory deletion, logged-out mode, and sensitive-site pauses.
- The design makes agent handoff feel natural: browse manually, ask, then escalate to agent mode.

## Where It Breaks Down

- The same simplicity can hide risk. If users treat the assistant as browser chrome, they may over-trust actions on logged-in sites.
- Memory-driven suggestions may feel helpful for research but invasive for private browsing.
- Agent progress in a side panel can become hard to audit if action logs and exact page observations are not exposed clearly.

## Screenshot References

- OpenAI launch screenshots: `https://openai.com/index/introducing-chatgpt-atlas/`
- Help center sidebar flow: `https://help.openai.com/en/articles/12628199-using-ask-chatgpt-sidebar-and-chatgpt-agent-on-atlas`

