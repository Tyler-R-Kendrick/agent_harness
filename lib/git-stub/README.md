# @agent-harness/git-stub

`@agent-harness/git-stub` provides a deterministic, browser-safe subset of Git commands for Agent Browser terminal sessions backed by `just-bash`.

The repository state is stored inside the active session filesystem at `.git-stub/state.json`. It supports local workflow commands such as `git init`, `git status`, `git add`, `git commit`, `git log`, `git diff`, `git branch`, and `git checkout -b` without depending on a native Git binary.
