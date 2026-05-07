import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HARNESS_STEERING_STATE,
  buildHarnessSteeringFiles,
  buildHarnessSteeringInventory,
  buildHarnessSteeringPromptContext,
  createHarnessSteeringCorrection,
  inferHarnessSteeringScope,
  isHarnessSteeringState,
} from './harnessSteering';

describe('harnessSteering', () => {
  it('creates scoped corrections and renders canonical steering files', () => {
    const correction = createHarnessSteeringCorrection({
      text: 'When the user says verify, run the full repo verifier.',
      source: 'manual',
      scope: 'workspace',
      now: new Date('2026-05-07T18:00:00.000Z'),
    });
    const state = { ...DEFAULT_HARNESS_STEERING_STATE, corrections: [correction] };

    const files = buildHarnessSteeringFiles(state);

    expect(files.map((file) => file.path)).toEqual([
      '.steering/STEERING.md',
      '.steering/user.steering.md',
      '.steering/project.steering.md',
      '.steering/workspace.steering.md',
      '.steering/session.steering.md',
      '.steering/agent.steering.md',
      '.steering/tool.steering.md',
    ]);
    expect(files.find((file) => file.scope === 'workspace')?.content).toContain(
      '- When the user says verify, run the full repo verifier.',
    );
    expect(files[0].content).toContain('[workspace](workspace.steering.md): 1 correction');
    expect(files[0].content).toContain('Updated: 2026-05-07T18:00:00.000Z');
  });

  it('validates state, infers scopes, and builds prompt context', () => {
    expect(isHarnessSteeringState(DEFAULT_HARNESS_STEERING_STATE)).toBe(true);
    expect(isHarnessSteeringState({ enabled: true, corrections: [{ id: 'bad' }] })).toBe(false);
    expect(inferHarnessSteeringScope('Remember this tool correction for shell commands')).toBe('tool');
    expect(inferHarnessSteeringScope('Keep this project steering rule')).toBe('project');

    const state = {
      ...DEFAULT_HARNESS_STEERING_STATE,
      corrections: [
        createHarnessSteeringCorrection({
          text: 'Keep user corrections exact.',
          source: 'chat',
          scope: 'user',
        }),
      ],
    };
    const inventory = buildHarnessSteeringInventory(state);

    expect(inventory.enabled).toBe(true);
    expect(inventory.totalCorrections).toBe(1);
    expect(inventory.fileRows.find((row) => row.scope === 'user')).toMatchObject({
      path: '.steering/user.steering.md',
      correctionCount: 1,
    });
    expect(buildHarnessSteeringPromptContext(inventory)).toContain('## Harness Steering');
    expect(buildHarnessSteeringPromptContext({ ...inventory, enabled: false })).toBe('');
  });
});
