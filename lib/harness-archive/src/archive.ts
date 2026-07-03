import { ArtifactRegistry } from 'harness-core';
import type { Artifact, ArtifactSnapshot } from 'harness-core';

import { canonicalizeDefinition, hashString } from './hash.js';
import type { GenomeInput, GenomeScores, HarnessGenome } from './types.js';

/**
 * Content-addressed archive of harness variants, backed by a harness-core
 * {@link ArtifactRegistry}. Each variant is stored as a stored artifact whose
 * id is the hash of its canonicalized definition; parent lineage and eval
 * scores live in the artifact metadata.
 *
 * Phase 0 (shadow) of the self-improvement loop: this archive only records and
 * reads variants. It never selects, gates, or promotes variants.
 */
export class HarnessArchive {
  private readonly registry: ArtifactRegistry;

  constructor(registry: ArtifactRegistry = new ArtifactRegistry()) {
    this.registry = registry;
  }

  /**
   * Record a harness variant. The id is content-addressed from the
   * canonicalized definition. If an artifact with that id already exists the
   * call is idempotent: the existing genome is returned unchanged and no
   * duplicate is created.
   */
  async record(input: GenomeInput): Promise<HarnessGenome> {
    const id = hashString(canonicalizeDefinition(input.definition));
    const existing = this.registry.get(id);
    if (existing !== undefined) {
      const genome = await this.get(id);
      return genome as HarnessGenome;
    }

    await this.registry.create({
      id,
      title: input.summary,
      data: input.definition,
      mediaType: 'text/plain',
      metadata: {
        parentId: input.parentId,
        scores: input.scores,
        summary: input.summary,
        generation: input.generation,
      },
    });

    return {
      id,
      parentId: input.parentId,
      summary: input.summary,
      definition: input.definition,
      scores: input.scores,
      generation: input.generation,
    };
  }

  /** Reconstruct a recorded genome by id, or `undefined` if it is not stored. */
  async get(id: string): Promise<HarnessGenome | undefined> {
    const artifact = this.registry.get(id);
    if (artifact === undefined) {
      return undefined;
    }
    const snapshot = await this.registry.read(artifact);
    if (snapshot === undefined) {
      return undefined;
    }
    return toGenome(artifact, snapshot);
  }

  /** Reconstruct every recorded genome. */
  async list(): Promise<HarnessGenome[]> {
    const genomes = await Promise.all(
      this.registry.list().map((artifact) => this.get(artifact.id)),
    );
    return genomes.map((genome) => genome as HarnessGenome);
  }

  /**
   * Walk the `parentId` chain from `id` toward the root, returning ids
   * leaf-first. Guards against missing parents and cycles: the walk stops at a
   * null/absent parent and never revisits an id.
   */
  async lineage(id: string): Promise<string[]> {
    const chain: string[] = [];
    const seen = new Set<string>();
    let currentId: string | null = id;

    while (currentId !== null) {
      if (seen.has(currentId)) {
        break;
      }
      const genome = await this.get(currentId);
      if (genome === undefined) {
        break;
      }
      seen.add(currentId);
      chain.push(currentId);
      currentId = genome.parentId;
    }

    return chain;
  }
}

function toGenome(artifact: Artifact, snapshot: ArtifactSnapshot): HarnessGenome {
  const metadata = artifact.metadata;
  return {
    id: artifact.id,
    parentId: metadata.parentId as string | null,
    summary: metadata.summary as string,
    definition: snapshot.data as string,
    scores: metadata.scores as GenomeScores,
    generation: metadata.generation as number,
  };
}
