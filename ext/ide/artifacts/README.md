# Artifacts

Default extension for standalone Agent Harness artifacts.

Artifacts are versioned output objects that can contain one or more files, reference other artifacts, and be attached to sessions as explicit context. Single-file artifacts download directly; multi-file artifacts are represented as bundles for zip export by Agent Browser.

## Package Boundary

Use the package root for the stable artifacts plugin import:

```ts
import { createArtifactsPlugin } from '@agent-harness/ext-artifacts';
```

Hosts that need plugin metadata should use the manifest export:

```ts
import manifest from '@agent-harness/ext-artifacts/manifest';
```

The root entry point also exports `ARTIFACT_BUNDLE_MEDIA_TYPE`, `ArtifactRenderer`, `encodeArtifactBundle`, and `decodeArtifactBundle` for extension registration and artifact bundle handling.

Do not deep-import files under `src/`; those modules are implementation details for the root entry point and artifact storage tools.

Published package contents intentionally include the README, plugin manifest, and runtime TypeScript source while excluding source tests and package tooling.
