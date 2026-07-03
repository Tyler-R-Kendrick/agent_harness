# @agent-harness/harness-archive

Content-addressed archive of harness variants with parent lineage and eval
scores, backed by the harness-core `ArtifactRegistry` (no new store).

This is **Phase 0 (shadow)** of the self-improvement loop
([ADR](../../docs/adr/2026-07-02-self-improvement-loop.md), Workstream D). The
archive only **records and reads** variants for later analysis. It never
selects, gates, or promotes variants — there is no evolution-in-place and no
automatic promotion. Those behaviours belong to later phases.

## What it provides

- **Content addressing.** A variant's id is `hashString(canonicalizeDefinition(definition))`.
  Two definitions that differ only in whitespace share an id.
- **Idempotent recording.** Recording the same definition twice returns the
  existing genome and never creates a duplicate artifact.
- **Lineage.** Walk the `parentId` chain from a leaf back to its root, guarded
  against missing parents and cycles.

The domain shapes (`HarnessGenome`, `GenomeScores`, `hashString`,
`canonicalizeDefinition`) mirror the ADAS research scaffold in
`research/adas-2408.08435/` so recorded variants line up with the offline
archive-search experiments.

## API

```ts
import { HarnessArchive } from '@agent-harness/harness-archive';

const archive = new HarnessArchive(); // or new HarnessArchive(registry)

// Record a variant. id is derived from the canonicalized definition.
const root = await archive.record({
  parentId: null,
  summary: 'baseline',
  definition: 'Baseline harness: read task, act, return answer.',
  scores: { quality: 0.4, cost: 0.1 },
  generation: 0,
});

const child = await archive.record({
  parentId: root.id,
  summary: 'baseline + reflect',
  definition: 'Baseline harness: read task, act, return answer. Reflect after each tool call.',
  scores: { quality: 0.56, cost: 0.2 },
  generation: 1,
});

await archive.get(child.id);       // HarnessGenome | undefined
await archive.list();              // HarnessGenome[]
await archive.lineage(child.id);   // [child.id, root.id]  (leaf -> root)
```

### Methods

- `record(input: GenomeInput): Promise<HarnessGenome>` — content-addressed,
  idempotent recording. `GenomeInput` is a `HarnessGenome` without its derived `id`.
- `get(id: string): Promise<HarnessGenome | undefined>` — reconstruct a genome.
- `list(): Promise<HarnessGenome[]>` — reconstruct every recorded genome.
- `lineage(id: string): Promise<string[]>` — ids leaf-first back to the root.

### Storage shape

Each variant is a stored `ArtifactRegistry` artifact:

- `id` — content-addressed genome id.
- `title` — the variant `summary`.
- `data` — the raw `definition` text (`mediaType: 'text/plain'`).
- `metadata` — `{ parentId, scores, summary, generation }`.

## Local development

```sh
npm run test
npm run test:coverage
```

100% coverage (lines, functions, branches, statements) is enforced.
