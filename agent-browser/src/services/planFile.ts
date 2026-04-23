import type { PlannedTask, TaskPlan, TaskStatus, TaskValidation } from './taskPlanner';

export const PLAN_FILE_PATH = '/workspace/PLAN.md';

function renderValidation(validation: TaskValidation): string {
  if (validation.kind === 'response-contains') {
    return `response-contains: ${validation.substrings.join(', ')}`;
  }
  if (validation.kind === 'workspace-file-exists') {
    return `workspace-file-exists: ${validation.path}`;
  }
  return `shell-command: ${validation.command}${validation.stdoutIncludes?.length ? ` | stdout includes: ${validation.stdoutIncludes.join(', ')}` : ''}`;
}

function renderTask(task: PlannedTask, index: number): string {
  return [
    `## Task ${index + 1}: ${task.title}`,
    `- ID: ${task.id}`,
    `- Status: ${task.status}`,
    `- Description: ${task.description}`,
    `- Tools: ${task.toolIds.join(', ')}`,
    `- Tool rationale: ${task.toolRationale ?? 'Not specified.'}`,
    `- Depends on: ${task.dependsOn.length ? task.dependsOn.join(', ') : 'None'}`,
    `- Notes: ${task.notes ?? 'None'}`,
    '- Validations:',
    ...task.validations.map((validation) => `  - ${renderValidation(validation)}`),
  ].join('\n');
}

export function renderPlanMarkdown(plan: TaskPlan): string {
  return [
    '# PLAN',
    '',
    `Goal: ${plan.goal}`,
    '',
    ...plan.tasks.map((task, index) => renderTask(task, index)),
    '',
  ].join('\n');
}

export function updateTaskStatus(plan: TaskPlan, taskId: string, status: TaskStatus, notes?: string): TaskPlan {
  return {
    ...plan,
    tasks: plan.tasks.map((task) => (
      task.id === taskId
        ? { ...task, status, ...(notes !== undefined ? { notes } : {}) }
        : task
    )),
  };
}