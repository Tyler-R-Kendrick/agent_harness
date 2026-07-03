import { ArtifactRegistry } from 'harness-core';
import { beforeEach, describe, expect, it } from 'vitest';

import { HarnessArchive } from '../archive.js';
import { canonicalizeDefinition, hashString } from '../hash.js';
import type { GenomeInput, GenomeScores } from '../types.js';

const scores: GenomeScores = { quality: 0.5, cost: 0.2 };

function input(overrides: Partial<GenomeInput> & Pick<GenomeInput, 'definition'>): GenomeInput {
  return {
    parentId: null,
    summary: 'variant',
    scores,
    generation: 0,
    ...overrides,
  };
}

describe('hash helpers', () => {
  it('canonicalizes by trimming and collapsing internal whitespace', () => {
    expect(canonicalizeDefinition('  read   task\t\nact  ')).toBe('read task act');
  });

  it('hashes deterministically with a genome prefix', () => {
    expect(hashString('read task act')).toBe(hashString('read task act'));
    expect(hashString('a')).toMatch(/^g[0-9a-z]+$/);
  });
});

describe('HarnessArchive', () => {
  let registry: ArtifactRegistry;
  let archive: HarnessArchive;

  beforeEach(() => {
    registry = new ArtifactRegistry();
    archive = new HarnessArchive(registry);
  });

  it('records a new genome with a content-addressed id', async () => {
    const genome = await archive.record(
      input({ definition: 'baseline: read, act, return', summary: 'baseline' }),
    );

    expect(genome.id).toBe(hashString(canonicalizeDefinition('baseline: read, act, return')));
    expect(genome.parentId).toBeNull();
    expect(genome.summary).toBe('baseline');
    expect(genome.definition).toBe('baseline: read, act, return');
    expect(genome.scores).toEqual(scores);
    expect(genome.generation).toBe(0);
    expect(registry.list()).toHaveLength(1);
  });

  it('defaults to a fresh ArtifactRegistry when none is injected', async () => {
    const standalone = new HarnessArchive();
    const genome = await standalone.record(input({ definition: 'default registry' }));
    expect(await standalone.get(genome.id)).toEqual(genome);
  });

  it('is idempotent: re-recording an identical definition dedupes', async () => {
    const first = await archive.record(input({ definition: 'reflect then act', summary: 'first' }));
    const second = await archive.record(
      input({ definition: 'reflect then act', summary: 'second', scores: { quality: 0.9, cost: 0.9 } }),
    );

    // Content-addressed dedupe: the original record wins, no duplicate stored.
    expect(second).toEqual(first);
    expect(second.summary).toBe('first');
    expect(registry.list()).toHaveLength(1);
  });

  it('treats whitespace-only variants as the same content-addressed id', async () => {
    const a = await archive.record(input({ definition: 'plan  sub-goals\tbefore acting' }));
    const b = await archive.record(input({ definition: '  plan sub-goals before   acting  ' }));

    expect(b.id).toBe(a.id);
    expect(registry.list()).toHaveLength(1);
  });

  it('gets a present genome and returns undefined for an absent id', async () => {
    const genome = await archive.record(input({ definition: 'verify with a rubric' }));

    expect(await archive.get(genome.id)).toEqual(genome);
    expect(await archive.get('gdoesnotexist')).toBeUndefined();
  });

  it('returns undefined from get when the artifact body cannot be read', async () => {
    // A remote artifact with no registered handler exists but has no readable body.
    registry.registerRemote({ id: 'gremote', uri: 'mem://missing' });
    expect(await archive.get('gremote')).toBeUndefined();
  });

  it('lists every recorded genome', async () => {
    const a = await archive.record(input({ definition: 'alpha', summary: 'a' }));
    const b = await archive.record(input({ definition: 'beta', summary: 'b' }));

    const listed = await archive.list();
    expect(listed).toHaveLength(2);
    expect(listed.map((g) => g.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('walks lineage leaf->root across a 3-deep chain', async () => {
    const root = await archive.record(input({ definition: 'root def', summary: 'root', generation: 0 }));
    const mid = await archive.record(
      input({ definition: 'mid def', summary: 'mid', parentId: root.id, generation: 1 }),
    );
    const leaf = await archive.record(
      input({ definition: 'leaf def', summary: 'leaf', parentId: mid.id, generation: 2 }),
    );

    expect(await archive.lineage(leaf.id)).toEqual([leaf.id, mid.id, root.id]);
  });

  it('stops lineage at a root with a null parent', async () => {
    const root = await archive.record(input({ definition: 'lonely root', parentId: null }));
    expect(await archive.lineage(root.id)).toEqual([root.id]);
  });

  it('stops lineage when a parent id is missing from the archive', async () => {
    const orphan = await archive.record(
      input({ definition: 'orphan def', parentId: 'gmissingparent' }),
    );
    expect(await archive.lineage(orphan.id)).toEqual([orphan.id]);
  });

  it('guards lineage against cycles', async () => {
    const defA = 'cycle a';
    const defB = 'cycle b';
    const idA = hashString(canonicalizeDefinition(defA));
    const idB = hashString(canonicalizeDefinition(defB));

    await archive.record(input({ definition: defA, summary: 'a', parentId: idB }));
    await archive.record(input({ definition: defB, summary: 'b', parentId: idA }));

    // A -> B -> A would loop forever without the seen-guard; it stops at [A, B].
    expect(await archive.lineage(idA)).toEqual([idA, idB]);
  });
});
