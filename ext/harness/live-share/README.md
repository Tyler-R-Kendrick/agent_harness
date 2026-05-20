# @agent-harness/ext-live-share

Adds live-share session tooling that enforces owner-defined authorization policies before granting remote view/control over WebRTC transports.

## Package Boundary

Use the package root for the stable plugin factory import:

```ts
import { createLiveSharePlugin } from '@agent-harness/ext-live-share';
```

Hosts that need plugin metadata should use the manifest export:

```ts
import manifest from '@agent-harness/ext-live-share/manifest';
```

Do not deep-import files under `src/`; those modules are implementation details
for the root entry point.
