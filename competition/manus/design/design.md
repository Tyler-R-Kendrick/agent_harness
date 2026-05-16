# Manus Design

## Look And Feel

- Manus presents itself as an agent workspace rather than a browser shell: users give a task, then inspect the agent's browser, files, and step log while work continues asynchronously.
- Browser Operator shifts the design from an isolated cloud session into a user-authorized local Chrome or Edge tab, using the user's current logins and active browser state.
- Preferred Browser adds an account-level environment choice so browser work can reuse the exact Chrome profile that has the right cookies, extensions, and internal-tool access.

## Design Tokens To Track

```yaml
surface: cloud agent workspace, local browser extension, task API
accent: autonomous delegation
primary_control: authorize browser control for a task
core_objects:
  - task
  - cloud browser
  - browser operator session
  - preferred browser
  - action log
  - file
  - API task
information_density: medium-high
```

## Differentiators

- Local browser operation competes with AI browsers by turning an existing logged-in browser into the automation surface instead of forcing the user into a new browser.
- The local-vs-cloud split is easy to understand: local for authenticated or sensitive sessions, cloud for general research and isolated work.
- Session authorization, stoppability by closing the tab, and action logs make trust controls visible in the product story.

## What Is Good

- The product acknowledges a real browser-agent problem: authenticated SaaS and internal tools often break cloud-only automation.
- Preferred Browser reduces setup repetition for recurring web tasks.
- API docs make Manus more than a consumer app; teams can create and manage tasks programmatically.

## Where It Breaks Down

- Local browser access increases the importance of allowlists, irreversible-action approvals, and secret handling.
- Credit usage and long-running task cost remain hard for users to predict before a task starts.
- Public user reports describe failed checkpoints, repeated "success" claims without enough testing, support frustration, and supervision time that can erase the promised savings.

## Screenshot References

- Browser Operator documentation screenshots: `https://manus.im/docs/features/browser-operator`
- Preferred Browser launch visuals: `https://manus.im/blog/manus-preferred-browser`
