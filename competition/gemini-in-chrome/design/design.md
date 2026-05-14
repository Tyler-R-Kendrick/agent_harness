# Gemini In Chrome Design

## Look And Feel

- Gemini appears as an integrated browser affordance rather than a new standalone browser: icon, side panel/window, tab context chips, and natural-language prompts.
- The design prioritizes low-friction assistance inside familiar Chrome chrome, especially current-page Q&A and up to 10 shared tabs.
- The newer side-panel direction makes AI persistent while shrinking page real estate, similar to Edge's Copilot pane and other AI-browser sidecars.
- AI Pointer extends that sidecar model with a direct manipulation layer: the pointer captures the local visual/semantic target, so users can say "this", "that", "move this", "merge those", or "add that" while staying in the original page.

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
  - AI Pointer point-and-ask
  - selected-product comparison
  - pointed-region visualization
  - image edit and map/place demos
trust_controls:
  - opt-in
  - stop sharing current tab
  - settings controls
  - Incognito exclusion
  - pointer-context disclosure
  - confirmation before external state changes
information_density: low-medium
```

## Differentiators

- Chrome distribution turns AI browsing from a separate product choice into a default-browser capability.
- Chrome history recall solves a common user problem: rediscovering a page by describing it instead of remembering exact keywords.
- Connected Google apps create a proprietary context advantage across Gmail, Calendar, Maps, YouTube, and Flights.
- AI Pointer reduces prompt burden by grounding shorthand in the pointed word, paragraph, image region, code block, product, place, date, or object.

## AI Pointer Principles To Copy

- Maintain the flow: assistance should work on the active page or app surface instead of forcing a copy/paste detour into a separate AI window.
- Show and tell: the pointer should capture visual and semantic context, including page provenance and coordinates, so the user does not need to write a long prompt.
- Embrace this and that: compact commands must resolve pronouns against the pointed target and any selected references.
- Turn pixels into actionable entities: point context should become structured products, places, dates, objects, recipes, tables, or notes with specific follow-up actions.

## What Is Good

- It keeps users in a known browser and avoids the migration cost of adopting Atlas, Comet, Dia, or Neon.
- The tab-sharing controls are visible enough to teach users what context Gemini is using.
- Cross-tab summarization and comparison are mainstream-friendly use cases.
- The pointer interaction makes page context feel embodied: compare selected products, visualize a couch in a room, edit an image, or find mapped places without translating the page into prose first.

## Where It Breaks Down

- Persistent AI panels compete with page content and can make Chrome feel more crowded.
- Availability rules are fragmented by country, account type, language, device, admin policy, and subscription tier.
- On-device AI models can consume substantial local storage, which can feel surprising if not disclosed clearly.
- Pointer capture can become creepy or unsafe if the UI does not clearly show what page region, entities, screenshots, or coordinates are flowing into the model.

## Screenshot References

- Official overview: `https://gemini.google/us/overview/gemini-in-chrome/`
- Chrome Help tab-sharing UI: `https://support.google.com/chrome/answer/16283624`
- Chrome history search requirements: `https://support.google.com/gemini/answer/16716225`
- AI Pointer announcement and demos: `https://deepmind.google/blog/ai-pointer/`
