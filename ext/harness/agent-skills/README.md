# Agent skills extension

Optional Agent Harness plugin for `.agents/skills/*/SKILL.md` assets.

This package is intentionally outside the root workspace build. Hosts load it
only when a user installs or selects the plugin manifest:

```ts
import { createAgentSkillsPlugin } from '@agent-harness/ext-agent-skills';
import manifest from '@agent-harness/ext-agent-skills/manifest';

await context.plugins.load(createAgentSkillsPlugin(files, { client }));
```

The package includes the former Agent Browser default skills under
`examples/default-workspace-skills/` as examples. They are not seeded into new
workspaces by Agent Browser.

## Package boundary

Use `@agent-harness/ext-agent-skills` as the stable root import for the plugin
factory and skill helpers. Use `@agent-harness/ext-agent-skills/manifest` when a
host needs to inspect the plugin manifest before loading the extension.

`examples/default-workspace-skills/` is published as example source material for
hosts that want to inspect or copy the former bundled skills. It is not runtime
code and should not be treated as a default workspace seed.

Do not deep-import files under `src/`; those files are implementation details of
the root package entry point.
