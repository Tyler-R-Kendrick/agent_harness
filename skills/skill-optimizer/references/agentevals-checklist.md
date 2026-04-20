# AgentEvals Checklist

Use this guide when creating or refreshing `evals/evals.json` for an optimized skill.

## Required bundle artifact

Create `evals/evals.json` at the skill root using this shape:

```json
{
  "skill_name": "target-skill-name",
  "evals": [
    {
      "id": 1,
      "prompt": "Realistic user request",
      "expected_output": "Human-readable success criteria",
      "files": [],
      "expectations": [
        "Concrete verifiable check"
      ]
    }
  ]
}
```

## Good eval design

- Use realistic prompts, not abstract placeholders.
- Include enough context that the model would actually benefit from loading the skill.
- Mix core success paths with near-miss prompts that test routing boundaries.
- Keep expectations concrete enough for a grader to verify with evidence.

## When optimizing a skill

Refresh evals if any of these changed:

- Trigger language in the description.
- The split between `SKILL.md` and `references/`.
- Deterministic scripts or validators the skill is now expected to use.
- Output structure or workflow ordering.

## Benchmark loop artifacts

When the user wants a full benchmark loop, create these additional files during execution:

- Per-eval `eval_metadata.json` with the prompt and assertions.
- Per-run `timing.json` with token and duration data.
- Per-run `grading.json` using `text`, `passed`, and `evidence` in each expectation result.
- Aggregated `benchmark.json` and `benchmark.md` after grading.

## Quality bar

An eval set is strong when:

- It proves the optimized skill still solves the intended problem.
- It catches overtriggering and undertriggering.
- It checks that deterministic code paths are actually used when they should be.
- It gives the user something worth reviewing in an output viewer rather than only pass or fail counters.