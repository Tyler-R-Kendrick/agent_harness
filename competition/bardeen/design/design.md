# Bardeen Design

## Look And Feel

- Browser-extension first product with a Chrome Web Store listing, screenshot carousel, in-tab overlay, and support docs that frame automations as "Playbooks" and "Autobooks".
- The interface language is non-technical: templates, prompts, actions, credits, and right-click automations rather than selectors, CDP sessions, or scripts.
- Design centers the current web page as the work surface. The extension appears over the active browser tab, which keeps the user close to logged-in context and page data.

## Design Tokens To Track

```yaml
surface: Chrome extension overlay plus template gallery
accent: productivity SaaS blue/purple with bright catalog screenshots
primary_control: create automation
core_objects:
  - playbook
  - autobook
  - template
  - action
  - trigger
  - monthly credit
  - connected app
information_density: medium
pricing_signal: freemium credits and paid integration tiers
```

## Differentiators

- Plain-language playbook creation lets users start from a prompt, a pre-built template, or a blank builder.
- Right-click automations are a strong browser-native design move because commands can live directly in the page context instead of a separate dashboard.
- Template categories map to concrete jobs such as sales prospecting, talent search, meeting workflows, data collection, and marketing.

## What Is Good

- The active-tab overlay reduces context switching for users who already live in Chrome.
- Builder-mode testing without credit use makes experimentation less risky than production-only credit meters.
- The catalog gives non-technical users a visible starting point before they understand automation primitives.

## Where It Breaks Down

- The product surface can feel like a catalog plus credit meter instead of a durable automation operations console.
- Chrome-extension permissions and page-history access create a trust burden that the UI has to continually earn.
- Template breadth is useful for onboarding, but broad sales/productivity positioning can blur the boundary between reliable repeatable automation and one-off scraping shortcuts.

## Screenshot References

- Chrome Web Store screenshot carousel for extension overlay, playbook builder, and template examples: `https://chromewebstore.google.com/detail/bardeen-automate-browser/ihhkmalpkhkoedlmcnilbbhhbhnicjga`
- Bardeen support screenshots for template selection, prompt creation, and manual builder: `https://support.bardeen.ai/hc/en-us/articles/23925126983053-Creating-Playbooks`
