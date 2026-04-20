# Eval Schema

Create eval suites under `.agents/<agent-name>/.evals/`.

## YAML shape

```yaml
name: <eval-name>
version: "1.0"
description: Describe what this eval suite verifies.
cases:
  - id: case-001
    description: Describe the case.
    prompt: |
      Put the user request here.
    assertions:
      - type: contains
        value: "expected text"
```

Use one YAML file per suite and stable case ids such as `case-001`.