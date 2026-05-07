# Gemini In Chrome Design

## Look And Feel

- Gemini appears as an integrated browser affordance rather than a new standalone browser: icon, side panel/window, tab context chips, and natural-language prompts.
- The design prioritizes low-friction assistance inside familiar Chrome chrome, especially current-page Q&A and up to 10 shared tabs.
- The newer side-panel direction makes AI persistent while shrinking page real estate, similar to Edge's Copilot pane and other AI-browser sidecars.

## Design Tokens To Track

```yaml
surface: familiar Chrome UI with Gemini assistant layer
accent: Google/Gemini blue-purple glow and iconography
primary_control: Gemini icon and prompt panel
secondary_controls:
  - current tab sharing
  - @tab selection
  - history search
  - connected Google apps
  - auto browse preview
trust_controls:
  - opt-in
  - stop sharing current tab
  - settings controls
  - Incognito exclusion
information_density: low-medium
```

## Differentiators

- Chrome distribution turns AI browsing from a separate product choice into a default-browser capability.
- Chrome history recall solves a common user problem: rediscovering a page by describing it instead of remembering exact keywords.
- Connected Google apps create a proprietary context advantage across Gmail, Calendar, Maps, YouTube, and Flights.

## What Is Good

- It keeps users in a known browser and avoids the migration cost of adopting Atlas, Comet, Dia, or Neon.
- The tab-sharing controls are visible enough to teach users what context Gemini is using.
- Cross-tab summarization and comparison are mainstream-friendly use cases.

## Where It Breaks Down

- Persistent AI panels compete with page content and can make Chrome feel more crowded.
- Availability rules are fragmented by country, account type, language, device, admin policy, and subscription tier.
- On-device AI models can consume substantial local storage, which can feel surprising if not disclosed clearly.

## Screenshot References

- Official overview: `https://gemini.google/us/overview/gemini-in-chrome/`
- Chrome Help tab-sharing UI: `https://support.google.com/chrome/answer/16283624`
- Chrome history search requirements: `https://support.google.com/gemini/answer/16716225`
