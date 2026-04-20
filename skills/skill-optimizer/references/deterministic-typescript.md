# Deterministic TypeScript Workflows

Use this guide when part of the skill optimization can be made more reliable with executable code.

Store the extracted code in the optimized skill's own `./scripts/` folder so the deterministic workflow ships with the skill it supports.

## When to write code instead of prose

Create a TypeScript helper in the optimized skill's `./scripts/` folder when the task includes repeatable logic such as:

- Parsing or rewriting frontmatter.
- Auditing reference links.
- Splitting sections out of `SKILL.md`.
- Building eval manifests.
- Validating file layouts or schemas.
- Packaging or reporting steps with deterministic outputs.

## Red/green workflow

1. Write the failing test first.
2. Implement the smallest script that makes the test pass.
3. Refactor for clarity while keeping the tests green.
4. Wire the script into the skill instructions so future runs do not reinvent it.

## Suggested file layout

```text
./scripts/
  resolve-optimization-plan.ts
  resolve-optimization-plan.test.ts
```

## Minimal example

```ts
import { describe, expect, it } from 'vitest';

import { classifySectionDestination } from './resolve-optimization-plan';

describe('classifySectionDestination', () => {
  it('keeps activation guidance in the main skill file', () => {
    expect(classifySectionDestination('Workflow', 'When to use the skill')).toBe('skill');
  });

  it('moves long schemas into references', () => {
    expect(classifySectionDestination('Schema', '{"type":"object"}')).toBe('reference');
  });
});
```

```ts
export function classifySectionDestination(title: string, body: string): 'skill' | 'reference' {
  const normalizedTitle = title.toLowerCase();
  const normalizedBody = body.toLowerCase();
  if (normalizedTitle.includes('schema') || normalizedBody.includes('json')) {
    return 'reference';
  }
  return 'skill';
}
```

## Constraints

- Prefer small, single-purpose scripts.
- Keep inputs and outputs explicit.
- Document how the script should be invoked from the skill.
- Keep the script inside the optimized skill bundle instead of placing it in a global helper location.
- Avoid adding code for work that is genuinely judgment-based rather than deterministic.
- For `skill-optimizer`, treat `resolve-optimization-plan.ts` as the deterministic backbone of the workflow rather than leaving the planning phase purely narrative.