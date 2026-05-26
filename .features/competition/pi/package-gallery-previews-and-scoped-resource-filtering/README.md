# Package Gallery Previews And Scoped Resource Filtering

- Harness: Pi
- Sourced: 2026-05-26

## What it is
Pi packages are no longer just tarballs of extensions and skills. They now have a documented gallery/distribution shape with preview metadata, install scopes, resource filtering, and deterministic global-vs-project deduplication.

## Evidence
- Official package docs: [docs/packages.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
- Official coding-agent README: [packages/coding-agent/README.md](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
- First-party details:
  - `packages.md` documents package-gallery metadata via `pi.video` and `pi.image`, so packages can expose a preview video or screenshot in the official gallery
  - packages can be installed from npm, git refs, raw GitHub URLs, or local paths, and project-local installs go into `.pi/settings.json` where missing packages auto-install on startup
  - `pi -e` installs a package ephemerally for a single run, which turns packages into lightweight experiment bundles rather than permanent setup
  - settings-level filters let users narrow a package down to exact resources or glob subsets across `extensions`, `skills`, `prompts`, and `themes`
  - the docs define scope-aware deduplication rules so a package can appear in both global and project settings while the project entry wins predictably

## Product signal
Pi is treating workflow packaging as an operational distribution channel, not just a developer convenience. Preview metadata, scoped installs, and resource filtering make package ecosystems easier to browse, safer to trial, and more practical for team-standardized harness setups.
