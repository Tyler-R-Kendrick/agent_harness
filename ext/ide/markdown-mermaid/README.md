# Markdown Mermaid Diagrams

Agent Harness file-renderer extension for Markdown and MDX artifacts that contain Mermaid diagrams.

The extension contributes `markdown-mermaid.renderer`, which binds the same Markdown paths as the base preview and has higher priority. Agent Browser renders the selected binding with Mermaid hydration enabled while keeping the raw diagram source available in the preview.

## Package Boundary

Use the package root for runtime registration:

```ts
import { createMarkdownMermaidPlugin } from '@agent-harness/ext-markdown-mermaid';
```

Use the manifest export when wiring extension metadata:

```ts
import manifest from '@agent-harness/ext-markdown-mermaid/manifest';
```

Do not deep-import files under `src/`; those paths are private implementation details even though the package ships TypeScript source.

Published package contents intentionally include `README.md`, `agent-harness.plugin.json`, and runtime `src/**/*.ts` files. Tests, coverage output, and local configuration stay outside the package tarball.
