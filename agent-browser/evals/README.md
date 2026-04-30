# Agent Browser Evals

Reusable eval criteria live in this directory and should be committed. That includes
`EVAL*.yaml` manifests, checked-in case files, fixtures, prompts, graders, and the
tests that validate those assets.

Generated run evidence does not belong in source control. AgentV transcripts,
grading files, timings, debug outputs, dev-server logs, visual-smoke screenshots,
and local caches should be written under ignored output or cache paths such as
`output/`, `.agentv/cache.json`, and `.codex/environments/`.

If a screenshot or proof artifact needs to live beyond a single run, move it to a
purposeful docs or PR-assets path and reference it from the PR instead of committing
the generated `output/` tree.
