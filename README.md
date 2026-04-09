# agent_harness

A collection of different agent harness UX POCs to experiment with.

## Bundled skills

The vendored project skills now live in the repo-root `skills/` directory so compatible agents can discover them directly from the checkout.

- Canonical skill sources: `skills/<skill-name>/`
- Compatibility links for agent tooling: `.agents/skills/<skill-name>` and `.claude/skills/<skill-name>`
- Copy or symlink the whole skill directory so bundled assets such as `agents/`, `scripts/`, and data files stay intact

## Installing a bundled skill in another repo

From the target repository:

```bash
mkdir -p .agents/skills
ln -snf /path/to/agent_harness/skills/frontend-design .agents/skills/frontend-design
```

If your agent client expects Claude-style project skills, create the matching link there as well:

```bash
mkdir -p .claude/skills
ln -snf /path/to/agent_harness/skills/frontend-design .claude/skills/frontend-design
```

## Installing bundled agents

Some skills include nested agent instructions, for example `skills/skill-creator/agents/`.

You do not install those separately—copying or symlinking the parent skill directory installs the packaged agents with it.

## Copilot setup

Copilot setup still attempts to register the Superpowers marketplace/plugin for Copilot sessions, but the bundled skills are now checked into the repository instead of being installed during setup.
