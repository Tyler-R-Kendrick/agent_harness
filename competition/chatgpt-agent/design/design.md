# ChatGPT Agent Design

## Look And Feel

- Chat-first task surface rather than a browser-first workspace.
- Agent activity is exposed through compact progress text, browser takeovers, terminal/code steps, file artifacts, and approval prompts.
- The visual language is familiar ChatGPT: neutral surfaces, conversation history, inline generated artifacts, and explicit pause/takeover controls when risk increases.

## Design Tokens To Track

```yaml
surface: neutral chat workspace with embedded browser and tool activity
accent: OpenAI green and subdued status states
primary_control: natural-language task request
secondary_controls:
  - stop or take over
  - connector selection
  - file upload and download
  - approval prompts for sensitive actions
trust_controls:
  - user confirmation before consequential actions
  - paused interaction for logins and CAPTCHAs
  - workspace and enterprise controls
information_density: medium
```

## Differentiators

- The product does not make users choose between browsing, code, spreadsheets, and documents; the same agent can traverse all of them.
- ChatGPT brand trust and account distribution make the UX feel like a default assistant rather than a specialized automation tool.
- The approval model is designed into the flow instead of added only as developer logs.

## What Is Good

- Very low activation energy for mainstream users already living in ChatGPT.
- Strong handoff pattern: the user can ask, observe, approve, and take over when needed.
- File and connector context make the browser only one part of a larger task environment.

## Where It Breaks Down

- Chat-first progress can hide exact browser state unless the user actively watches or takes over.
- The general-purpose surface can be slower and less deterministic than a dedicated browser automation script.
- Plan limits, model availability, and workspace policy can make the same task feel inconsistent across accounts.

## Screenshot References

- Official launch examples: `https://openai.com/index/introducing-chatgpt-agent/`
- Help center product controls: `https://help.openai.com/en/articles/11752874-chatgpt-agent`
