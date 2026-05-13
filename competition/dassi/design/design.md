# dassi Design

## Look And Feel

- Consumer productivity SaaS style: clean white surfaces, soft rounded panels, Chrome sidebar framing, and plain-language work examples.
- The design avoids heavy developer terminology on the main page, then moves detail into docs and use-case pages.
- Trust language is prominent: "your accounts stay in your browser", approvals before action, model choice, and local browser context.

## Design Tokens To Track

```yaml
surface: light consumer productivity
accent: blue/purple AI assistant cues
primary_control: Chrome side panel chat
secondary_controls:
  - approve action
  - save as skill
  - schedule workflow
  - model/provider selection
trust_controls:
  - local browser execution
  - user approval before actions
  - no credential storage by vendor
  - BYOK option
information_density: medium
```

## Differentiators

- Aims at ordinary Chrome/Edge/Brave users rather than agent infrastructure buyers.
- Turns repeated browser work into saved/scheduled skills.
- Emphasizes direct page context and local accounts without copy-pasting into a separate chat app.

## What Is Good

- The product story is simple: install a sidebar agent, ask it to work on the current page, approve actions.
- Privacy positioning is more accessible than many MCP/server products.
- Use cases map to recognizable work: email replies, research, forms, LinkedIn outreach, data extraction, CRM updates, and documents.

## Where It Breaks Down

- Consumer-friendly simplicity can hide the hard parts: what exact data goes to the chosen model, how page screenshots are handled, and how failed actions are undone.
- Ratings/user-count claims differ across first-party pages, which weakens confidence in marketing precision.
- Sidebar UX can become cramped for long workflows, multi-tab state, audit trails, and skill editing.

## Screenshot References

- Main product page: https://www.dassi.ai/
- Browser-agent use case: https://www.dassi.ai/use-cases/ai-browser-agent/
- Docs: https://docs.dassi.ai/
