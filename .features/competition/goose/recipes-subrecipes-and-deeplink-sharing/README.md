# Recipes, Subrecipes, And Deeplink Sharing

- Harness: Goose
- Sourced: 2026-05-03

## What it is
Goose recipes package prompts, extensions, parameters, and settings into reusable agent workflows that can be stored locally, shared, launched by link, and composed into subrecipes.

## Evidence
- Official docs: [Recipes](https://goose-docs.ai/docs/guides/recipes/)
- Official docs: [Reusable Recipes](https://goose-docs.ai/docs/guides/recipes/session-recipes/)
- Official docs: [Saving Recipes](https://goose-docs.ai/docs/guides/recipes/storing-recipes/)
- Official tool: [Recipe Generator](https://goose-docs.ai/recipe-generator)
- First-party details:
  - Goose defines recipes as reusable workflows that bundle extensions, prompts, and settings together.
  - Recipes can be stored globally or inside a project-local `.goose/recipes/` folder for team-specific workflows.
  - Recipes can call subrecipes, including multiple subrecipe instances in parallel.
  - Goose supports recipe deeplinks and a hosted recipe generator so users can share launchable workflows instead of only sharing YAML files.
- Latest development checkpoint:
  - the current docs and generators show Goose investing in link-based workflow distribution, not just local prompt templates

## Product signal
Goose is turning successful agent setups into portable workflow assets with packaging and distribution primitives that look more like app launchers than saved prompts.
