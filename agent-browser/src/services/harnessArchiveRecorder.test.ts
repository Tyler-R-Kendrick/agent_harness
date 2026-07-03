import { describe, expect, it } from 'vitest';
import { HarnessArchive } from '@agent-harness/harness-archive';
import { buildHarnessEvolutionPlan } from './harnessEvolution';
import {
  createHarnessEvolutionGenomeInput,
  recordHarnessEvolutionGenome,
} from './harnessArchiveRecorder';

const plan = buildHarnessEvolutionPlan({
  request: {
    componentId: 'Agent Browser harness',
    changeSummary: 'Improve the chat composer',
    touchesStyling: true,
  },
});

describe('createHarnessEvolutionGenomeInput', () => {
  it('maps a plan to a genome input with defaults', () => {
    const input = createHarnessEvolutionGenomeInput(plan);

    expect(input.summary).toBe(plan.summary);
    expect(input.definition).toContain(plan.summary);
    expect(input.definition).toContain(plan.componentId);
    expect(input.definition).toContain(plan.sandboxPath);
    expect(input.scores).toEqual({ quality: 0, cost: 0 });
    expect(input.parentId).toBeNull();
    expect(input.generation).toBe(0);
  });

  it('applies provided parentId, generation, and scores', () => {
    const input = createHarnessEvolutionGenomeInput(plan, {
      parentId: 'gparent',
      generation: 3,
      scores: { quality: 0.8, cost: 0.4 },
    });

    expect(input.parentId).toBe('gparent');
    expect(input.generation).toBe(3);
    expect(input.scores).toEqual({ quality: 0.8, cost: 0.4 });
  });
});

describe('recordHarnessEvolutionGenome', () => {
  it('records into a real archive and is idempotent for the same plan', async () => {
    const archive = new HarnessArchive();

    const first = await recordHarnessEvolutionGenome(archive, plan);
    const second = await recordHarnessEvolutionGenome(archive, plan);

    expect(first).toBeDefined();
    expect(second).toEqual(first);
    expect(await archive.list()).toHaveLength(1);
    expect(first?.summary).toBe(plan.summary);
  });

  it('swallows archive errors and returns undefined (record-only)', async () => {
    const throwingArchive = {
      record: async () => {
        throw new Error('archive unavailable');
      },
    } as unknown as HarnessArchive;

    await expect(recordHarnessEvolutionGenome(throwingArchive, plan)).resolves.toBeUndefined();
  });
});
