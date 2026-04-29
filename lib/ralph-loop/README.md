# ralph-loop

Completion heuristics for iterative agent task execution.

## Public API

Import from the package root:

```ts
import { createHeuristicCompletionChecker } from 'ralph-loop';
```

The package intentionally exposes only the root entry point declared in
`package.json`. Deep imports into `src/` are internal and should not be treated
as stable.

## Runtime Dependency

`ralph-loop` builds on the public completion-checker contracts exported by
`logact`. Consumers should install a compatible `logact` version alongside this
package when it is used outside this workspace.
