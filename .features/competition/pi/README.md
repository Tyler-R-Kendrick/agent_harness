# Pi

- Harness: Pi
- Sourced: 2026-05-26
- Canonical sources:
  - [Pi coding-agent README](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
  - [Providers docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/providers.md)
  - [Custom providers docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/custom-provider.md)
  - [Packages docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md)
  - [RPC docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/rpc.md)
  - [Releases](https://github.com/earendil-works/pi/releases)

## Overview
Pi is an open-source agent harness and agent toolkit centered on a coding-agent CLI, a reusable runtime, and an unusually deep extension surface. The current public repo is `earendil-works/pi`; earlier notes in this corpus may still reference the older `badlogic/pi-mono` repo name.

## Feature docs in this corpus
- [Build your own minimal core](./build-your-own-minimal-core/README.md)
- [Context files and system prompt layering](./context-files-and-system-prompt-layering/README.md)
- [Embeddable runtimes, JSON RPC, and SDK](./embeddable-runtimes-json-rpc-and-sdk/README.md)
- [Extension-defined provider auth and interactive login choices](./extension-defined-provider-auth-and-interactive-login-choices/README.md)
- [Interactive TUI and queued steering](./interactive-tui-and-queued-steering/README.md)
- [Multi-provider and custom model routing](./multi-provider-and-custom-model-routing/README.md)
- [Package gallery previews and scoped resource filtering](./package-gallery-previews-and-scoped-resource-filtering/README.md)
- [Session export, share, and OSS publishing](./session-export-share-and-oss-publishing/README.md)
- [Session tree branching and compaction](./session-tree-branching-and-compaction/README.md)
- [Skills, extensions, themes, and Pi packages](./skills-extensions-themes-and-pi-packages/README.md)

## Current research signal
- Pi continues to treat the harness as both a human-facing CLI and an embeddable runtime.
- The most important recent delta is its provider plane: extension-defined auth flows now plug into `/login`, can offer multiple login choices, refresh tokens, and reshape model catalogs after authentication.
- The package surface is also maturing beyond simple installability into previewable package-gallery metadata, scoped resource filtering, and predictable global-vs-project deduplication.
