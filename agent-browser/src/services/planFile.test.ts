import { describe, expect, it } from 'vitest';
import { renderPlanMarkdown, updateTaskStatus } from './planFile';
import type { TaskPlan } from './taskPlanner';

describe('planFile', () => {
  const plan: TaskPlan = {
    goal: 'Repair the workflow',
    tasks: [
      {
        id: 'inspect-flow',
        title: 'Inspect workflow',
        description: 'Read the current implementation and identify the seam.',
        toolIds: ['read_session_file', 'cli'],
        toolRationale: 'Need source inspection and shell verification.',
        validations: [
          { id: 'v1', kind: 'response-contains', substrings: ['workflow seam'] },
          { id: 'v2', kind: 'workspace-file-exists', path: '/workspace/PLAN.md' },
        ],
        dependsOn: [],
        status: 'pending',
      },
    ],
  };

  it('renders deterministic markdown with tool metadata and validations', () => {
    const markdown = renderPlanMarkdown(plan);

    expect(markdown).toContain('# PLAN');
    expect(markdown).toContain('Goal: Repair the workflow');
    expect(markdown).toContain('## Task 1: Inspect workflow');
    expect(markdown).toContain('- Status: pending');
    expect(markdown).toContain('- Tools: read_session_file, cli');
    expect(markdown).toContain('- Tool rationale: Need source inspection and shell verification.');
    expect(markdown).toContain('response-contains');
    expect(markdown).toContain('workspace-file-exists');
  });

  it('updates one task status and notes without mutating unrelated fields', () => {
    const next = updateTaskStatus(plan, 'inspect-flow', 'done', 'Verified the seam and wrote PLAN.md.');

    expect(next.tasks[0]).toEqual({
      ...plan.tasks[0],
      status: 'done',
      notes: 'Verified the seam and wrote PLAN.md.',
    });
    expect(plan.tasks[0].status).toBe('pending');
  });
});