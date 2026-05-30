# HyperFrames IDE extension

This extension contributes:

- a dedicated HyperFrames editor pane,
- a sidebar-style configuration model,
- and a preview artifact payload for generated HyperFrames outputs.

Hosts load the extension explicitly:

```ts
import { createHyperframesPlugin } from '@agent-harness/ext-hyperframes';

await context.plugins.load(createHyperframesPlugin());
```

The package exposes two stable import paths:

```ts
import {
  DEFAULT_HYPERFRAMES_CONFIG,
  HYPERFRAMES_RENDERER,
  HyperframesEditorPane,
  HyperframesPreviewRenderer,
  createHyperframesArtifact,
  createHyperframesPlugin,
  createPreviewHtml,
} from '@agent-harness/ext-hyperframes';

import manifest from '@agent-harness/ext-hyperframes/manifest';
```

Do not import from `@agent-harness/ext-hyperframes/src/*`; source files are
implementation details behind the package root.

## Published package contents

Published artifacts include `README.md`, `agent-harness.plugin.json`, and runtime
source files. Package-internal tests and local config stay out of the tarball.
