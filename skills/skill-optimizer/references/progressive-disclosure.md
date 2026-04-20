# Progressive Disclosure Patterns

Use this guide when a target `SKILL.md` has grown too large or too reference-heavy.

## Keep the main prompt lean

The main `SKILL.md` should answer only the questions that matter at activation time:

1. What is this skill for?
2. When should it trigger?
3. What is the short workflow the model should follow?
4. Which deeper documents should be read next, and under what conditions?

If a section is useful only after the model has already decided to use the skill, it is a candidate for `references/`.

## Good candidates to move out

- Exhaustive examples.
- Multiple JSON schemas.
- Full benchmark instructions.
- Long troubleshooting trees.
- Framework-specific recipes.
- Historical rationale that does not change runtime behavior.

## How to split safely

1. Leave a short summary in `SKILL.md`.
2. Move the full material into a clearly named markdown file under `references/`.
3. Add a pointer that says when the deeper file should be read.
4. Re-check that the main file still makes sense on its own.

## Anti-patterns

- Moving the trigger language into a reference file.
- Leaving `SKILL.md` so thin that the model has no usable workflow.
- Copying the same long guidance into multiple reference files.
- Keeping stale examples in `SKILL.md` after moving the updated ones into `references/`.

## Decision rule

If the content helps the model decide whether to use the skill, keep it in `SKILL.md`.

If the content helps the model execute after the skill is already chosen, move it to `references/`.