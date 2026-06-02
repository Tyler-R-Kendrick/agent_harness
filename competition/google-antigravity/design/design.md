# Google Antigravity Design

## Look And Feel

- Agent-first IDE and standalone agent manager rather than a classic code editor with a chat panel.
- The product emphasizes high-level agent supervision: tasks, plans, conversation, artifact review, browser evidence, and verification outputs.
- Google marketing leans on a polished futuristic identity, animated product pages, and a "build in the agent-first era" narrative.

## Design Tokens To Track

```yaml
surface: IDE, standalone agent manager, CLI, browser extension, artifact review
accent: Google Gemini blue/purple product styling with developer-tool chrome
primary_control: delegate task to autonomous agent
core_objects:
  - agent
  - task
  - plan
  - artifact
  - browser recording
  - screenshot
  - code diff
  - terminal command
  - model picker
information_density: high
trust_surfaces:
  - artifacts
  - screenshots
  - browser recordings
  - task lists
  - secure mode
  - rate-limit and plan surfaces
```

## Differentiators

- Antigravity makes the browser one of the agent's native work surfaces alongside editor and terminal.
- Artifacts, screenshots, and browser recordings are positioned as the communication layer between agent and human.
- The agent manager design treats the developer like a supervisor of concurrent workers rather than a chat participant.
- Model optionality and Google account distribution can pull users who already use Gemini or Google AI plans.

## What Is Good

- Browser-in-the-loop verification is a strong product lesson: coding agents should prove frontend changes with visible evidence.
- Artifact review gives a more structured handoff than raw tool logs.
- The design acknowledges that autonomous agents need plans, screenshots, recordings, and summaries to stay reviewable.
- A standalone agent manager can scale better than a narrow IDE sidebar when multiple tasks are active.

## Where It Breaks Down

- The futuristic agent-first framing can obscure concrete permission boundaries until something risky happens.
- Broad editor, terminal, and browser authority creates a large blast radius.
- Users complain about compute limits, product churn, and uncertainty around Google's long-term focus between Jules, Gemini CLI, AI Studio, and Antigravity.
- Artifact polish can make failures feel more trustworthy than they deserve if raw traces and exact commands are hard to audit.

## Screenshot References

- Antigravity product and documentation pages: `https://antigravity.google/`
- Antigravity overview/docs: `https://antigravity.google/docs/home`
