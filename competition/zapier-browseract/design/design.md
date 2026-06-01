# Zapier BrowserAct Design

## Look And Feel

- Standard Zapier app-directory page with a white background, orange brand accents, app icon blocks, and a simple "agent chat" illustration.
- The page is structured as an MCP app card: hero, supported action, three setup steps, related apps, and FAQ.
- Visual hierarchy is integration-first. BrowserAct appears as one Zapier action surface, not a full browser product.

## Design Tokens Observed

- Dominant palette: Zapier orange, white, black, and light gray.
- Component language: app-logo tiles, CTA buttons, setup-step headings, and FAQ blocks.
- Interaction language: generate secure MCP URL, choose actions, connect with Cursor or another AI tool.

## What Differentiates It

- BrowserAct is packaged as an app/action in the Zapier MCP ecosystem. That makes browser automation feel like one more scoped capability an AI assistant can call.
- The "secure MCP URL" setup pattern is familiar to Zapier users and easier than hosting an MCP server.
- The task-quota explanation gives a concrete cost unit: one MCP tool call uses two Zapier tasks.

## What Is Good

- The design is low-friction for existing Zapier users because it reuses familiar integration language.
- The supported-action section is explicit: "Run a Workflow" rather than vague autonomous browsing.
- The FAQ surfaces an important enterprise limitation: Zapier MCP does not currently support Enterprise app and action restrictions out of the box.

## Where It Breaks Down

- There is little visible browser evidence: no session replay, screenshot trail, page-level trace, or failure recovery UI is shown on the public page.
- BrowserAct is abstracted into Zapier workflow language, so buyers cannot easily inspect whether a workflow used brittle UI navigation, app APIs, or both.
- The app-directory frame undersells browser-specific trust risks such as prompt injection, CAPTCHA walls, logged-in session scope, and silent partial completion.

## Sources

- https://zapier.com/mcp/browseract
- https://www.reddit.com/r/AI_Agents/comments/1s59fli/the_just_use_zapier_advice_is_getting_outdated/
- https://www.reddit.com/r/AiAutomations/comments/1t8eqit/i_replaced_about_half_my_zapier_zaps_with_an/
