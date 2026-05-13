# @agent-harness/git-stub

`@agent-harness/git-stub` provides a deterministic, browser-safe subset of Git commands for Agent Browser terminal sessions backed by `just-bash`.

The repository state is stored inside the active session filesystem at `.git-stub/state.json`. It supports local workflow commands such as `git init`, `git status`, `git add`, `git commit`, `git log`, `git diff`, `git branch`, and `git checkout -b` without depending on a native Git binary.

## Package boundary

Use the root package import for all supported runtime APIs:

```ts
import { createGitStubRepository, executeGitStubCommand } from '@agent-harness/git-stub';
```

The package intentionally publishes only `README.md`, `package.json`, and runtime TypeScript source files under `src/`. `src/repository.ts` and `src/types.ts` are implementation modules; consumers should treat the root export in `src/index.ts` as the stable public API and avoid deep imports.
