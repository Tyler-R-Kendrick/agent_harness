import { describe, expect, it, vi } from 'vitest';
import { evaluateTaskValidations } from './taskValidation';
import type { TaskValidation } from './taskPlanner';

describe('taskValidation', () => {
  it('passes when all validations succeed', async () => {
    const validations: TaskValidation[] = [
      { id: 'v1', kind: 'response-contains', substrings: ['workflow seam'] },
      { id: 'v2', kind: 'workspace-file-exists', path: '/workspace/PLAN.md' },
      { id: 'v3', kind: 'shell-command', command: 'test-command', expectExitCode: 0, stdoutIncludes: ['ok'] },
    ];

    const result = await evaluateTaskValidations(validations, {
      responseText: 'I found the workflow seam and documented it.',
      listWorkspacePaths: async () => ['/workspace/PLAN.md'],
      runShellCommand: async () => ({ exitCode: 0, stdout: 'ok', stderr: '' }),
    });

    expect(result.done).toBe(true);
    expect(result.feedback).toContain('All validations passed');
  });

  it('fails with actionable feedback when any validation fails', async () => {
    const validations: TaskValidation[] = [
      { id: 'v1', kind: 'response-contains', substrings: ['workflow seam'] },
      { id: 'v2', kind: 'workspace-file-exists', path: '/workspace/PLAN.md' },
    ];

    const result = await evaluateTaskValidations(validations, {
      responseText: 'No useful output.',
      listWorkspacePaths: async () => [],
      runShellCommand: vi.fn(),
    });

    expect(result.done).toBe(false);
    expect(result.feedback).toContain('response-contains');
    expect(result.feedback).toContain('workspace-file-exists');
  });
});