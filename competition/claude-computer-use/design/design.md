# Claude Computer Use Design

## Look And Feel

- Anthropic supplies the model capability, reference demo, and safety docs rather than a polished consumer browser.
- The demo pattern is a split between conversation, screenshot stream, and remote desktop/browser state.
- Design center is developer trust: sandboxing, tool schema clarity, screenshots, action logs, and risk warnings.

## Design Tokens To Track

```yaml
surface: developer console or integrating app
accent: Claude neutral/amber brand family when surfaced by Anthropic examples
primary_control: developer prompt plus computer tool availability
secondary_controls:
  - screenshot observation
  - cursor and click actions
  - shell or browser environment
  - sandbox reset
trust_controls:
  - isolated VM or container
  - allowlisted domains and actions
  - prompt-injection warnings
  - human review for sensitive actions
information_density: high
```

## Differentiators

- It works at the whole-computer level, not only browser DOM automation.
- The API model lets other products embed computer use into their own UX.
- Anthropic's documentation foregrounds security and deployment risk, which is useful for enterprise buyers.

## What Is Good

- Developer teams can build exactly the UI, policy, and audit layer they need.
- Computer-level control handles legacy apps and non-web workflows that browser-only products cannot.
- The reference demo gives a practical starting point for sandboxed experimentation.

## Where It Breaks Down

- Users do not get a polished product unless an integrator builds one.
- Pixel-level control is slower and more failure-prone than structured browser APIs when DOM access is available.
- Security burden shifts heavily to the developer or enterprise team.

## Screenshot References

- Anthropic launch demos: `https://www.anthropic.com/news/3-5-models-and-computer-use`
- Computer-use quickstart demo: `https://github.com/anthropics/anthropic-quickstarts/tree/main/computer-use-demo`
