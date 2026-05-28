# AgentsRoom Browser MCP Design

## Look And Feel

- AgentsRoom uses a dense productivity cockpit: project list, agent cards, terminal panes, roles, status dots, activity groups, prompt library, backlog, and mobile companion.
- The browser automation feature is presented as a visible embedded Chromium panel rather than an invisible headless session.
- The visual language is multi-agent IDE first, browser automation second.
- Screenshots and page copy emphasize status clarity: who is working, who is done, who is stuck, and what changed.

## Design Tokens Observed

```yaml
visual_language:
  mode: desktop IDE cockpit
  layout:
    - left project navigation
    - agent grid/cards
    - terminal/activity stream
    - embedded browser panel
  status_colors:
    working: yellow
    done: green
    waiting: red
  roles:
    - DevOps
    - Frontend
    - Backend
    - Architect
    - QA
    - Fullstack
    - Security
    - PM
interaction_patterns:
  primary_actions:
    - add agent
    - assign role
    - enable browser access
    - review diff
    - run browser verification
```

## Differentiators

- The design makes agent orchestration visible before it makes browser control visible. This is strong for teams running multiple coding agents in parallel.
- Browser automation is framed as QA signoff: open localhost, click, type, screenshot, read console logs, and verify before saying done.
- Per-project Chromium session partitions are a good design primitive for preventing project credential leakage.
- Screenshot-after-action and console-log access support a stronger evidence loop than pure unit-test completion.

## Where It Breaks Down

- The page is broad: multi-agent orchestration, mobile app, tunnel, backlog, prompt library, skills, review, provider switching, and browser automation all compete for attention.
- The "one screen" promise risks becoming crowded for small teams that only want a browser agent.
- Browser access is one feature inside a larger IDE. Teams may not adopt it if they do not want to move their agent workflow into AgentsRoom.
- Pricing and packaging were not visible from the browser-automation feature page, which complicates buyer evaluation.

## Sources

- https://agentsroom.dev/
- https://agentsroom.dev/features/browser-automation
