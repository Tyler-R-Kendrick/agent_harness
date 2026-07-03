# STEERING.md

Generalized reasoning-strategy corrections — guidance on *how to reason* about
a class of task, distinct from the concrete operating rules in `AGENTS.md`.

Each rule is numbered with its rationale and mapped to a runtime steering
`scope` (`user` / `project` / `workspace` / `session` / `agent` / `tool`) so it
reconciles with the runtime `.steering/` system (`harnessSteering.ts`, the
`Steering` chat agent) rather than duplicating it. These are stable, repo-level
strategies; ephemeral corrections belong in the scoped `.steering/` files.

## Rules

1. **Turn criticized runtime behavior into regression evidence first.**
   *Scope: project.* When the user criticizes runtime agent behavior, treat
   the supplied runtime context (request, response, chat history, tool
   trajectory, AgentBus/process entries, screenshots) as reproduction
   evidence. Capture it as explicit regression tests or eval fixtures before
   or while fixing the behavior, and assert the bad output/tool path does not
   recur. *Rationale: behavior regressions without a captured fixture reappear;
   the fixture is what makes the fix durable and reviewable.*

2. **Reach for a checked-in script before an ad hoc command.**
   *Scope: tool.* Before writing an inline Playwright snippet, shell loop,
   temporary script, or long ad hoc command, check `package.json`, `scripts/`,
   and relevant skill `scripts/` directories for an existing command. If you
   repeat a dynamic sequence, promote it into a documented repo script. *Rationale:
   deterministic checked-in commands are reproducible, reviewable, and reusable
   by the next agent; regenerated one-offs drift.*

3. **Validate at the smallest scope that covers your change.**
   *Scope: project.* Run the smallest deterministic validation set that covers
   the files you changed; prefer project-local tests, evals, lint, build, and
   coverage over repo-wide gates. Reserve the full `verify:agent-browser` gate
   for cross-project, dependency/CI/release, or explicitly requested runs.
   *Rationale: scoped validation gives faster, clearer signal and avoids
   false failures from unrelated surfaces.*

4. **Treat any validation you run as blocking.**
   *Scope: project.* Warnings or failures from a validation you chose to run
   are blocking; fix them in the same turn whenever they are in scope and can
   be fixed without reverting the user's work. *Rationale: a validation whose
   failures are ignored is worse than no validation — it launders red as green.*

5. **Scaffold with project CLIs, not hand-authored files.**
   *Scope: tool.* Use project-specific CLI tools (`npm`, `dotnet`, `uv`, etc.)
   to scaffold new packages/projects instead of manually creating and editing
   the boilerplate. *Rationale: generators produce the canonical, up-to-date
   structure and wiring; hand-rolled scaffolds miss conventions and rot.*
