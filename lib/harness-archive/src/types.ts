/**
 * Domain model for the harness-variant archive.
 *
 * These shapes mirror the ADAS research scaffold
 * (`research/adas-2408.08435/experiments/experiment-01-harness-archive-search.ts`)
 * so recorded variants line up with the offline archive-search experiments.
 */

/** Eval scores attached to a recorded harness variant. */
export interface GenomeScores {
  readonly quality: number;
  readonly cost: number;
}

/**
 * A recorded harness variant.
 *
 * `id` is content-addressed: it is derived from the canonicalized
 * `definition`, so two variants with the same (whitespace-normalized)
 * definition share an id and are deduplicated.
 */
export interface HarnessGenome {
  readonly id: string;
  readonly parentId: string | null;
  readonly summary: string;
  readonly definition: string;
  readonly scores: GenomeScores;
  readonly generation: number;
}

/**
 * Input accepted by {@link HarnessArchive.record}. It is a {@link HarnessGenome}
 * without its `id`, because the id is derived from the definition.
 */
export type GenomeInput = Omit<HarnessGenome, 'id'>;

/** A single node in a lineage walk from a leaf variant back toward its root. */
export interface LineageEntry {
  readonly id: string;
  readonly parentId: string | null;
  readonly generation: number;
}
