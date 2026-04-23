export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export type ResponseContainsValidation = {
  id: string;
  kind: 'response-contains';
  substrings: string[];
};

export type WorkspaceFileExistsValidation = {
  id: string;
  kind: 'workspace-file-exists';
  path: string;
};

export type ShellCommandValidation = {
  id: string;
  kind: 'shell-command';
  command: string;
  expectExitCode?: number;
  stdoutIncludes?: string[];
};

export type TaskValidation =
  | ResponseContainsValidation
  | WorkspaceFileExistsValidation
  | ShellCommandValidation;

export type PlannedTask = {
  id: string;
  title: string;
  description: string;
  toolIds: string[];
  toolRationale?: string;
  validations: TaskValidation[];
  dependsOn: string[];
  status: TaskStatus;
  notes?: string;
};

export type TaskPlan = {
  goal: string;
  tasks: PlannedTask[];
};

export type PlannerToolDescriptor = {
  id: string;
  label: string;
  description: string;
};

function extractJsonObject(text: string): string | null {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  const directObject = normalized.match(/\{[\s\S]*\}/);
  return directObject?.[0] ?? null;
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  values.forEach((value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  });
  return ordered;
}

function normalizeValidation(raw: unknown): TaskValidation | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : null;
  const kind = typeof candidate.kind === 'string' ? candidate.kind.trim() : null;
  if (!id || !kind) return null;

  if (kind === 'response-contains') {
    const substrings = Array.isArray(candidate.substrings)
      ? candidate.substrings.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    if (!substrings.length) return null;
    return { id, kind, substrings };
  }

  if (kind === 'workspace-file-exists') {
    const path = typeof candidate.path === 'string' ? candidate.path.trim() : '';
    if (!path) return null;
    return { id, kind, path };
  }

  if (kind === 'shell-command') {
    const command = typeof candidate.command === 'string' ? candidate.command.trim() : '';
    if (!command) return null;
    const stdoutIncludes = Array.isArray(candidate.stdoutIncludes)
      ? candidate.stdoutIncludes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : undefined;
    return {
      id,
      kind,
      command,
      ...(typeof candidate.expectExitCode === 'number' ? { expectExitCode: candidate.expectExitCode } : {}),
      ...(stdoutIncludes?.length ? { stdoutIncludes } : {}),
    };
  }

  return null;
}

export function buildTaskPlanPrompt({
  workspaceName,
  userPrompt,
  coordinatorProblem,
  toolCatalog,
}: {
  workspaceName: string;
  userPrompt: string;
  coordinatorProblem: string;
  toolCatalog: PlannerToolDescriptor[];
}): string {
  return [
    `Workspace: ${workspaceName}`,
    `User request: ${userPrompt}`,
    `Chosen problem: ${coordinatorProblem}`,
    '',
    'Plan the work as executable tasks.',
    'For each task, choose only the tools it actually needs and define validations BEFORE execution.',
    'Return JSON only with this shape:',
    '{',
    '  "goal": string,',
    '  "tasks": [',
    '    {',
    '      "id": string,',
    '      "title": string,',
    '      "description": string,',
    '      "toolIds": string[],',
    '      "toolRationale": string,',
    '      "dependsOn": string[],',
    '      "validations": [',
    '        { "id": string, "kind": "response-contains", "substrings": string[] }',
    '        | { "id": string, "kind": "workspace-file-exists", "path": string }',
    '        | { "id": string, "kind": "shell-command", "command": string, "expectExitCode": number, "stdoutIncludes": string[] }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'Rules:',
    '- Use only tool ids from the catalog below.',
    '- Every task must have at least one tool id.',
    '- Every task must have at least one validation.',
    '- Validations must be machine-verifiable, not subjective.',
    '- Keep tasks dependency-aware and avoid overlap.',
    '',
    'Available tool catalog:',
    ...toolCatalog.map((tool) => `- ${tool.id}: ${tool.label} — ${tool.description}`),
  ].join('\n');
}

export function parseTaskPlan(text: string, allowedToolIds: readonly string[]): TaskPlan | null {
  const jsonObject = extractJsonObject(text);
  if (!jsonObject) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonObject);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Record<string, unknown>;
  const goal = typeof candidate.goal === 'string' ? candidate.goal.trim() : '';
  const tasks = Array.isArray(candidate.tasks) ? candidate.tasks : [];
  if (!goal || !tasks.length) return null;

  const allowed = new Set(allowedToolIds);
  const normalizedTasks: PlannedTask[] = tasks.flatMap((task) => {
    if (!task || typeof task !== 'object') return [];
    const next = task as Record<string, unknown>;
    const id = typeof next.id === 'string' ? next.id.trim() : '';
    const title = typeof next.title === 'string' ? next.title.trim() : '';
    const description = typeof next.description === 'string' ? next.description.trim() : '';
    const toolIds = uniqueStrings(
      (Array.isArray(next.toolIds) ? next.toolIds : [])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => allowed.has(value)),
    );
    const validations = (Array.isArray(next.validations) ? next.validations : [])
      .map(normalizeValidation)
      .filter((value): value is TaskValidation => value !== null);
    const dependsOn = uniqueStrings(
      (Array.isArray(next.dependsOn) ? next.dependsOn : [])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    );

    if (!id || !title || !description || !toolIds.length || !validations.length) return [];

    return [{
      id,
      title,
      description,
      toolIds,
      ...(typeof next.toolRationale === 'string' && next.toolRationale.trim()
        ? { toolRationale: next.toolRationale.trim() }
        : {}),
      validations,
      dependsOn,
      status: 'pending' as const,
    }];
  });

  if (!normalizedTasks.length) return null;
  return { goal, tasks: normalizedTasks };
}