import { describe, expect, it } from 'vitest';
import type { SkillDefinition, TaskEnvelope } from './skillContracts';
import { executeCompositeTask } from './compositeExecutor';
import { SkillRegistry } from './skillRegistry';
import { buildSkillRouteTelemetry, routeTaskToSkill } from './skillRouter';

function makeTask(overrides: Partial<TaskEnvelope> = {}): TaskEnvelope {
  return {
    taskId: 'task-1',
    taskType: 'planner',
    input: { prompt: 'hello' },
    capabilityTags: ['planning'],
    ...overrides,
  };
}

describe('skill registry', () => {
  it('registers and lists skills deterministically', () => {
    const registry = new SkillRegistry();
    registry.register({ id: 'b', displayName: 'B', capabilityTags: ['planning'], inputSchemaHint: 'x', outputSchemaHint: 'y', execute: async () => 'ok' });
    registry.register({ id: 'a', displayName: 'A', capabilityTags: ['coding'], inputSchemaHint: 'x', outputSchemaHint: 'y', execute: async () => 'ok' });

    expect(registry.get('a')?.displayName).toBe('A');
    expect(registry.list().map((skill) => skill.id)).toEqual(['b', 'a']);
  });
});

describe('skill router', () => {
  it('returns ranked candidates and reason codes', () => {
    const skills: SkillDefinition[] = [
      { id: 'planner', displayName: 'Planner', capabilityTags: ['planning'], inputSchemaHint: 'x', outputSchemaHint: 'y', execute: async () => ({ ok: true }) },
      { id: 'coder', displayName: 'Coder', capabilityTags: ['coding'], inputSchemaHint: 'x', outputSchemaHint: 'y', execute: async () => ({ ok: true }) },
    ];

    const decision = routeTaskToSkill(makeTask(), skills);
    expect(decision.selectedSkillId).toBe('planner');
    expect(decision.reasonCode).toBe('exact-task-type-match');
    expect(decision.ranking[0]?.reasonCodes).toContain('capability-match');
    expect(buildSkillRouteTelemetry(makeTask(), decision).event).toBe('skill.route');
  });

  it('uses low-confidence fallback reason when top scores are close', () => {
    const skills: SkillDefinition[] = [
      { id: 'a', displayName: 'A', capabilityTags: ['planning'], inputSchemaHint: 'x', outputSchemaHint: 'y', execute: async () => ({ ok: true }) },
      { id: 'b', displayName: 'B', capabilityTags: ['planning'], inputSchemaHint: 'x', outputSchemaHint: 'y', execute: async () => ({ ok: true }) },
    ];
    const decision = routeTaskToSkill(makeTask({ taskType: 'x' }), skills);
    expect(decision.reasonCode).toBe('fallback-low-confidence');
  });
});

describe('composite executor', () => {
  it('emits route and step telemetry and executes until terminal output', async () => {
    const telemetry: string[] = [];
    const skills: SkillDefinition[] = [
      {
        id: 'planner',
        displayName: 'Planner',
        capabilityTags: ['planning'],
        inputSchemaHint: 'x',
        outputSchemaHint: 'y',
        execute: async (task) => ({ nextTask: { ...task, taskId: 'task-2', capabilityTags: ['coding'], taskType: 'coder' } }),
      },
      {
        id: 'coder',
        displayName: 'Coder',
        capabilityTags: ['coding'],
        inputSchemaHint: 'x',
        outputSchemaHint: 'y',
        execute: async () => ({ done: true }),
      },
    ];

    const result = await executeCompositeTask(makeTask(), skills, {
      emitTelemetry: (event) => telemetry.push(event.event),
    });

    expect(result).toEqual({ done: true });
    expect(telemetry).toEqual(['skill.route', 'skill.step', 'skill.route', 'skill.step']);
  });

  it('guards against recursion with max depth and max steps', async () => {
    const loopingSkill: SkillDefinition = {
      id: 'loop',
      displayName: 'Loop',
      capabilityTags: ['planning'],
      inputSchemaHint: 'x',
      outputSchemaHint: 'y',
      execute: async (task) => ({ nextTask: { ...task } }),
    };

    await expect(executeCompositeTask(makeTask({ taskType: 'loop' }), [loopingSkill], { maxDepth: 2 })).rejects.toThrow(/maxDepth/);
    await expect(executeCompositeTask(makeTask({ taskType: 'loop' }), [loopingSkill], { maxDepth: 100, maxSteps: 2 })).rejects.toThrow(/maxSteps/);
  });
});
