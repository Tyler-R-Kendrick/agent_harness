# Agent skills extension

Optional Agent Harness plugin for `.agents/skills/*/SKILL.md` assets.

This package is intentionally outside the root workspace build. Hosts load it
only when a user installs or selects the plugin manifest:

```ts
import { createAgentSkillsPlugin } from '@agent-harness/ext-agent-skills';

await context.plugins.load(createAgentSkillsPlugin(files, { client }));
```

The package includes the former Agent Browser default skills under
`examples/default-workspace-skills/` as examples. They are not seeded into new
workspaces by Agent Browser.
