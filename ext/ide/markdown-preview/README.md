# Markdown Preview

Default Agent Harness file-renderer extension for Markdown and MDX artifacts.

The extension contributes `markdown-preview.renderer`, which binds common Markdown paths such as `.md`, `.mdx`, `.markdown`, `.mdown`, and `.mkd`, plus `text/markdown` and `text/mdx` media types. Agent Browser renders the binding with its sanitized Markdown preview surface.

## Package Boundary

Use the package root for the stable renderer plugin import:

```ts
import { createMarkdownPreviewPlugin } from '@agent-harness/ext-markdown-preview';
```

Hosts that need plugin metadata should use the manifest export:

```ts
import manifest from '@agent-harness/ext-markdown-preview/manifest';
```

Do not deep-import files under `src/`; those modules are implementation details
for the root entry point and renderer registration.

Published package contents intentionally include the README, plugin manifest,
and runtime TypeScript source while excluding source tests and package tooling.
