# Opera Neon Design

## Look And Feel

- Neon revives Opera's experimental-browser brand with a polished, futuristic AI workspace rather than a utilitarian developer tool.
- The interface is structured around named AI modes: Chat for assistance, Do for browser actions, Make for generated web apps, and Tasks/Cards for reusable context.
- Product visuals emphasize integrated AI panes, task containers, and community-shared prompt cards.

## Design Tokens To Track

```yaml
surface: polished experimental browser
accent: neon gradients and high-contrast AI mode highlights
primary_control: mode-specific AI prompt
secondary_controls:
  - Chat
  - Do
  - Make
  - Tasks
  - Cards store
  - pause or take over
trust_controls:
  - local browser session for Do
  - user can pause or take control
  - no need to share passwords with cloud services for browser-local actions
information_density: medium-high
```

## Differentiators

- Neon separates AI jobs into named contexts instead of presenting one all-purpose assistant.
- "Cards" turn repeatable prompting into a visible product object and community marketplace surface.
- Opera emphasizes that Do operates inside the user's actual browser session, reducing repeated login and cloud-password handoff friction.

## What Is Good

- Mode names make the ambition memorable: chat, do, and make are easy to market.
- Cards are a strong design pattern for packaging best-practice prompts without hiding them in automation internals.
- The browser-local action model is easier to explain than fully remote cloud browsing for logged-in tasks.

## Where It Breaks Down

- Multiple AI modes can create choice overload; users may not know whether a request belongs in Chat, Do, Make, or Research.
- A futuristic brand raises expectations for smoothness, but agent latency and wrong clicks make rough edges more visible.
- Subscription pricing makes early-product confusion more painful because users compare it against free built-in browser AI.

## Screenshot References

- Official launch and release imagery: `https://press.opera.com/2025/05/28/opera-neon-the-first-ai-agentic-browser/`
- Public access announcement screenshots: `https://press.opera.com/2025/12/11/opera-opens-public-access-to-opera-neon-its-experimental-agentic-ai-browser/`
- FAQ feature descriptions: `https://help.opera.com/en/neon-ai-faq/`
