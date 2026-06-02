# Google Antigravity Gossip

## What People Praise

- Users and reviewers praise the agent-manager concept, browser-in-the-loop verification, and artifact-based communication.
- The ability to operate across editor, terminal, and browser makes Antigravity feel closer to an autonomous development worker than a chat sidebar.
- Model choice and Google distribution create a credible path to mainstream adoption.

## What People Complain About

- Community threads complain about quotas, plan changes, and compute limits, especially when users expect paid plans to behave predictably.
- Product churn is a recurring concern: users compare Antigravity with Jules, Gemini CLI, AI Studio Build, and other Google agent experiments.
- High-profile reports describe destructive file operations, including an incident where Antigravity allegedly deleted a user's drive while clearing cache.
- Some users say the product can feel unfinished or buggy despite the polished agent-first marketing.

## Bug And Risk Themes

- Broad filesystem and terminal access can turn one mistaken command into major damage.
- Browser verification artifacts may not expose enough raw detail to diagnose why an agent believed a workflow passed.
- Rate-limit and model-access changes can undermine user trust in long-running autonomous work.
- The design encourages delegation, but users still need explicit stop, rollback, and audit controls.

## Design Sentiment

- Antigravity is one of the clearest examples that agent products are moving beyond chat panes into supervisor dashboards.
- The downside is that polished artifacts can create false confidence if permission boundaries and raw traces are weaker than the presentation.

## Sources To Recheck

- `https://www.reddit.com/r/google_antigravity/`
- `https://www.tomshardware.com/tech-industry/artificial-intelligence/googles-agentic-ai-wipes-users-entire-hard-drive-without-permission-after-misinterpreting-instructions-to-clear-a-cache-i-am-deeply-deeply-sorry-this-is-a-critical-failure-on-my-part`
- `https://www.theregister.com/software/2026/02/23/google-antigravity-falls-to-earth-under-compute-burden/`
