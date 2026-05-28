# DESIGN.md extension

Optional Agent Harness plugin for `DESIGN.md` design-token assets.

`harness-core` and Agent Browser no longer apply DESIGN.md behavior by default.
Hosts that want design-token guidance, CSS rendering, or constrained code
substitution load this package explicitly:

```ts
import { createDesignMdPlugin } from '@agent-harness/ext-design-md';

await context.plugins.load(createDesignMdPlugin({ documents }));
```

The package exposes two stable import paths:

```ts
import {
  buildDesignMdGuidanceMessage,
  createCssDesignTokenApplyProvider,
  createDesignMdPlugin,
  createLlGuidanceDesignSubstitutionProvider,
  discoverDesignMdSemanticHooks,
  listDesignMdThemeOptions,
  renderDesignMdCss,
} from '@agent-harness/ext-design-md';

import manifest from '@agent-harness/ext-design-md/manifest';
```

Do not import from `@agent-harness/ext-design-md/src/*`; source files are
implementation details behind the package root.

## Published package contents

Published artifacts include `README.md`, `agent-harness.plugin.json`, runtime
source files, and example implementation files. Example implementation files are included, but example tests are excluded so consumers get runnable examples without shipping package-internal validation fixtures.
