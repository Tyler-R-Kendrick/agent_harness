# Chromeflow Design

## Look And Feel

- Developer-launch-page style with installation commands, terminal mockups, Chrome extension mockups, and before/after task examples.
- The design is concrete and task-led: Stripe setup, SaaS provisioning, LinkedIn outreach, YouTube transcript mining.
- The comparison table makes the product category explicit: not test automation, not cloud browser agents, not generic computer use, but guided real-browser setup work.

## Design Tokens To Track

```yaml
surface: Chrome extension plus MCP/plugin commands
visual_style: terminal-forward developer landing page
primary_objects:
  - plugin
  - chrome_extension
  - real_chrome_session
  - browser_action
  - approval_pause
  - env_file_update
  - release_gate
interaction_model:
  - install_plugin
  - install_extension
  - ask_agent
  - agent_drives_existing_session
  - pause_for_2fa_password_or_payment
evidence_style:
  - live visible browser
  - per-platform validation notes
  - working_as_of_dates
```

## Differentiators

- Chromeflow sells the exact gap between natural-language setup instructions and painful dashboard tab-switching.
- It emphasizes existing logged-in Chrome sessions and manual pauses for 2FA, passwords, and payments.
- The "working as of" and release-gate framing is unusually concrete for a small MCP/browser-extension product.

## What Is Good

- The homepage explains the use case in the user's words: stop copying setup guides between Claude and Chrome.
- The comparison table clearly distinguishes local guided work from Playwright, Browser Use, Computer Use, and Stagehand.
- It validates a key agent-browser wedge: browser-agent UX must preserve human context, approvals, and local account state.

## Where It Breaks Down

- The design is optimized for Claude Code power users; non-technical buyers may bounce on plugin commands and terminal-heavy copy.
- "Anything you can do in a browser" and outreach/mining examples can raise abuse and account-risk concerns.
- Open-source extension/MCP products face trust friction around native hosts, extension permissions, and connection health.

## Screenshot References

- Install flow, comparison table, and task examples: `https://chromeflow.run/`
