# Cursor Background Agents Design

## Look And Feel

- IDE-native, with agents presented as another sidebar/work queue inside the coding environment.
- Background agents emphasize status, branch changes, machine takeover, and follow-up prompts rather than a separate project-management UI.
- Bugbot extends the same workflow into pull requests by commenting review findings and offering a "fix in Cursor" style loop.

## Design Tokens To Track

```yaml
surface: desktop IDE, background-agent sidebar, remote machine, GitHub app, PR review
accent: code-first dark IDE
primary_control: start background agent
core_objects:
  - background agent
  - remote machine
  - branch
  - environment.json
  - pull request
  - bug finding
information_density: high
```

## Differentiators

- Agent execution is close to the IDE, so users can delegate and then take over in the same product.
- `.cursor/environment.json` makes environment setup a repo artifact that can be committed and shared.
- Background agents clone from GitHub, work on dedicated branches, and push back for review.

## What Is Good

- The mental model is familiar to engineers: branch, diff, PR, review, iterate.
- Remote machines with install/start/terminal configuration make agent execution more repeatable than ad hoc chat.
- Cursor can combine local interactive coding, remote background work, and PR review under one brand.

## Where It Breaks Down

- The design is strongest for code tasks and weaker for browser-centric evidence, screenshots, and end-user workflow proof.
- Pricing tied to model API usage can be hard to estimate for long or parallel agent runs.
- PR review automation can create noisy or stale comments when findings move or partial file context misses the broader change.

## Screenshot References

- Background agent docs and sidebar references: `https://docs.cursor.com/en/background-agent`
- Bugbot docs: `https://docs.cursor.com/bugbot`
