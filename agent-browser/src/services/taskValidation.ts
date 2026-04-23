import type { TaskValidation } from './taskPlanner';

export type TaskValidationRuntime = {
  responseText: string;
  listWorkspacePaths: () => Promise<string[]> | string[];
  runShellCommand: (command: string) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
};

export async function evaluateTaskValidations(
  validations: readonly TaskValidation[],
  runtime: TaskValidationRuntime,
): Promise<{ done: boolean; feedback: string }> {
  const failures: string[] = [];
  const workspacePaths = await runtime.listWorkspacePaths();

  for (const validation of validations) {
    if (validation.kind === 'response-contains') {
      const missing = validation.substrings.filter((substring) => !runtime.responseText.includes(substring));
      if (missing.length) {
        failures.push(`${validation.id} (${validation.kind}) missing: ${missing.join(', ')}`);
      }
      continue;
    }

    if (validation.kind === 'workspace-file-exists') {
      if (!workspacePaths.includes(validation.path)) {
        failures.push(`${validation.id} (${validation.kind}) missing path: ${validation.path}`);
      }
      continue;
    }

    const result = await runtime.runShellCommand(validation.command);
    const expectedExitCode = validation.expectExitCode ?? 0;
    if (result.exitCode !== expectedExitCode) {
      failures.push(`${validation.id} (${validation.kind}) exit code ${result.exitCode} !== ${expectedExitCode}`);
      continue;
    }
    const missingStdout = (validation.stdoutIncludes ?? []).filter((part) => !result.stdout.includes(part));
    if (missingStdout.length) {
      failures.push(`${validation.id} (${validation.kind}) stdout missing: ${missingStdout.join(', ')}`);
    }
  }

  if (!failures.length) {
    return { done: true, feedback: 'All validations passed.' };
  }

  return {
    done: false,
    feedback: failures.join('\n'),
  };
}