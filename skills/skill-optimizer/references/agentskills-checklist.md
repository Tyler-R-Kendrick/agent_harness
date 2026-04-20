# Agentskills Checklist

Use this checklist while optimizing a target skill for agentskills.io compliance.

## Frontmatter

- Preserve the existing `name` unless the user explicitly requests a rename.
- Keep the description as a single inline string, not a folded block.
- Make the description do the routing work: what the skill does, when to use it, and what adjacent prompts should still trigger it.
- Keep optional fields such as `license`, `metadata`, `compatibility`, and `allowed-tools` if they are still correct.

## Main file versus references

Keep in `SKILL.md`:

- The skill identity and trigger language.
- The short workflow the model should follow every time.
- Constraints that directly change runtime behavior.
- References to deeper docs when needed.

Move into `references/`:

- Long rubrics or scoring systems.
- Large example banks.
- JSON schemas.
- Troubleshooting matrices.
- Migration playbooks that are only needed for certain targets.

## Trigger quality

- Prefer concrete phrases the user would actually type.
- Include adjacent phrasings that should still trigger the skill even if the user does not name the skill directly.
- Be careful with negative routing language. Keep it only when disambiguation is required.
- Avoid turning the description into a general README. If it cannot influence routing, it probably belongs elsewhere.

## Completion bar

The optimized skill should end with:

- A smaller, easier-to-trigger `SKILL.md`.
- Reference docs that hold the long-form material.
- Eval coverage that exercises the current behavior rather than the old one.
- Deterministic helpers extracted into code when the workflow is mechanical.