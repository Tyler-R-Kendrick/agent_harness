# DX — agent_harness

Standard: the **Monorepo DX Playbook** (canonical in the `HoBo` repo → `docs/standards/monorepo-dx-playbook.md`,
`https://github.com/Tyler-R-Kendrick/HoBo/blob/main/docs/standards/monorepo-dx-playbook.md`).

## Current state
TS ESM app+lib monorepo, **polyglot** (Node/TS + Deno `agent-daemon` + PowerShell gates). Primary app `agent-browser`
(React + Vite). npm workspaces but **the lockfile is gitignored** (`.gitignore` → `package-lock.json`) → CI/devcontainer
run `npm install`, not `npm ci` → **non-reproducible installs**. **Not pinned.** No Turborepo (vestigial `.turbo/` +
`.eslintcache` ignores for absent tools). **No JS linter** (`lint` = `tsc --noEmit`). No shared `tsconfig.base`. Real
gate `verify:agent-browser` is a **local** PowerShell script, not in CI. **No git hooks.** CI is thin but wrong:
`daemon-build.yml` path-filters on the **gitignored** `package-lock.json` (never matches). Vercel **direct** git auto-deploy.

## Adoption checklist (leverage order)
1. 🔥 **Commit the lockfile** — remove `package-lock.json` from `.gitignore`; switch CI/devcontainer to `npm ci`
   (or migrate to pnpm). Non-reproducible installs are the top risk. **[S]**
2. **Pin the toolchain** (`packageManager`/`engines`); add a shared `tsconfig.base`. **[S]**
3. **Add Turborepo** (retire the bespoke Node/PowerShell orchestration); remove the vestigial `.turbo/` ignore. **[M]**
4. **Add a linter (Biome)** — `lint` is currently only `tsc --noEmit`. **[M]**
5. **Native git hooks** — wire the existing `verify:agent-browser` gate into `pre-push` (affected); fast checks into
   `pre-commit` (staged). **[M]**
6. **Fix the CI footgun** — `daemon-build.yml` filters on the gitignored lockfile. Keep the Windows/Deno daemon build
   (a legit env-only artifact); drop/repair the copilot-setup workflow. **No Vercel deploy workflow** (direct-to-Vercel). **[S]**

Workflow policy (playbook §8): the Windows/Deno build qualifies as an un-hookable env-only artifact; the Vercel app does
**not** earn a deploy workflow while it's direct-to-Vercel.
