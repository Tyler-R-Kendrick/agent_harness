# Automa Design

## Look And Feel

- Block-based extension builder with documentation organized around workflow concepts and block categories.
- Visual language is closer to developer tools than consumer AI: trigger blocks, browser blocks, web interaction blocks, control flow, data blocks, variables, tables, storage, and JavaScript execution context.
- Chrome Web Store positioning is simple and utility-led: autofill forms, repetitive tasks, screenshots, scraping, and scheduling.

## Design Tokens To Track

```yaml
surface: browser extension workflow builder
accent: open-source utility/developer-tool styling
primary_control: connect automation blocks
core_objects:
  - workflow
  - trigger block
  - browser block
  - web interaction block
  - control flow block
  - variable
  - table
  - package
information_density: high
pricing_signal: free extension and open-source repository
```

## Differentiators

- Deep block catalog covers browser control, web interaction, control flow, online services, data manipulation, and JavaScript escape hatches.
- Open-source GitHub presence builds credibility with technical users and gives them a place to inspect issues or contribute fixes.
- Local extension distribution lowers adoption friction for users who want automation without a hosted browser provider.

## What Is Good

- The block taxonomy makes the automation mental model explicit: trigger, navigate, interact, branch, loop, extract, store, and export.
- JavaScript execution and variable/table primitives create an escape path for advanced users who outgrow purely visual steps.
- Free extension availability and 200,000-user Chrome Web Store scale make it an important baseline for browser-workflow expectations.

## Where It Breaks Down

- High block density can overwhelm beginners before they understand selector stability, variables, or execution context.
- Open-source issue volume signals an active product but also exposes many unresolved edge cases around selectors, iframes, login, and browser version changes.
- There is little evidence of a first-class agent approval, replay, or governance surface; the product is automation-builder first, not agent-operations first.

## Screenshot References

- Chrome Web Store screenshots and video thumbnails for the extension builder: `https://chromewebstore.google.com/detail/automa/infppggnoaenmfagbfknfkancpbljcca`
- Docs navigation for block taxonomy and workflow concepts: `https://docs.extension.automa.site/`
