# Gemini Agent Design

## Look And Feel

- Google-first assistant surface: clean white cards, rounded inputs, multicolor Gemini marks, and lightweight progress states.
- Project Mariner demos emphasize a browser side panel or assistant layer that reads pages, plans, clicks, and keeps the user in control.
- Gemini product surfaces are increasingly multimodal and cross-app, so browser work is framed as one assistant capability inside Google's ecosystem.

## Design Tokens To Track

```yaml
surface: Google material-style assistant cards and browser overlays
accent: Gemini blue-purple gradient and Google multicolor brand cues
primary_control: prompt to Gemini or agent mode
secondary_controls:
  - step review
  - tab and page context
  - Google app connectors
  - account-level plan access
trust_controls:
  - user supervision
  - visible browser state
  - Google account security model
information_density: medium
```

## Differentiators

- Native proximity to Chrome and Google account data is difficult for independent tools to match.
- Project Mariner's research framing focuses on human-agent interaction, not only raw automation.
- Gemini can bridge web pages with Gmail, Calendar, Drive, Search, and Android use cases.

## What Is Good

- Familiar Material-style UI reduces adoption friction.
- Browser state and Google account continuity make personal tasks feel natural.
- Google's reach can normalize agentic browsing for nontechnical users.

## Where It Breaks Down

- Ecosystem breadth can bury exact agent evidence behind a generic assistant surface.
- Users outside Google Workspace or Chrome may see less value.
- Google account data access raises privacy and policy concerns for users who want explicit local-first boundaries.

## Screenshot References

- Project Mariner screenshots and demo framing: `https://deepmind.google/discover/blog/project-mariner-exploring-the-future-of-human-agent-interaction-starting-with-your-browser/`
- Gemini product update examples: `https://blog.google/products/gemini/google-gemini-update-may-2025/`
