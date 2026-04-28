import { describe, expect, it } from 'vitest';
import {
  createEvaluationAgentRegistry,
  type CustomEvaluationAgent,
} from './evaluationAgentRegistry';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe('evaluationAgentRegistry', () => {
  it('persists custom teacher voters and judge configs per workspace', () => {
    const storage = memoryStorage();
    const registry = createEvaluationAgentRegistry(storage, 'ws-research');
    const teacher: CustomEvaluationAgent = {
      id: 'teacher-accessibility',
      kind: 'teacher',
      name: 'Accessibility Teacher',
      instructions: 'Steer candidates toward accessible UI.',
      enabled: true,
    };
    const judge: CustomEvaluationAgent = {
      id: 'judge-evals',
      kind: 'judge',
      name: 'Eval Judge',
      instructions: 'Score with local evals.',
      enabled: true,
      rubricCriteria: ['candidate cites executed tests'],
    };

    registry.save([teacher, judge]);

    expect(createEvaluationAgentRegistry(storage, 'ws-research').list()).toEqual([teacher, judge]);
    expect(createEvaluationAgentRegistry(storage, 'ws-other').list()).toEqual([]);
  });

  it('stores adversary rubric hardening separately from custom agents', () => {
    const storage = memoryStorage();
    const registry = createEvaluationAgentRegistry(storage, 'ws-research');

    registry.addNegativeRubricTechnique('keyword-stuffing');
    registry.addNegativeRubricTechnique('keyword-stuffing');
    registry.addNegativeRubricTechnique('ignores task facts');

    expect(registry.listNegativeRubricTechniques()).toEqual([
      'keyword-stuffing',
      'ignores task facts',
    ]);

    registry.resetNegativeRubricTechniques();
    expect(registry.listNegativeRubricTechniques()).toEqual([]);
  });
});
