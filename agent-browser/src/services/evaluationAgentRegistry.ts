export type EvaluationAgentKind = 'teacher' | 'judge';

export interface CustomEvaluationAgent {
  id: string;
  kind: EvaluationAgentKind;
  name: string;
  instructions: string;
  enabled: boolean;
  rubricCriteria?: string[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const AGENTS_KEY_PREFIX = 'agent-browser:evaluation-agents:';
const NEGATIVE_RUBRIC_KEY_PREFIX = 'agent-browser:negative-rubric-techniques:';

function agentsKey(workspaceId: string): string {
  return `${AGENTS_KEY_PREFIX}${workspaceId}`;
}

function negativeRubricKey(workspaceId: string): string {
  return `${NEGATIVE_RUBRIC_KEY_PREFIX}${workspaceId}`;
}

function parseAgents(raw: string | null): CustomEvaluationAgent[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => normalizeAgent(value));
  } catch {
    return [];
  }
}

function normalizeAgent(value: unknown): CustomEvaluationAgent[] {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  if (kind !== 'teacher' && kind !== 'judge') return [];
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const instructions = typeof record.instructions === 'string' ? record.instructions.trim() : '';
  if (!id || !name || !instructions) return [];
  const rubricCriteria = Array.isArray(record.rubricCriteria)
    ? record.rubricCriteria.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined;
  return [{
    id,
    kind,
    name,
    instructions,
    enabled: record.enabled !== false,
    ...(rubricCriteria && rubricCriteria.length ? { rubricCriteria } : {}),
  }];
}

function parseStringList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

export function createEvaluationAgentRegistry(storage: StorageLike | null | undefined, workspaceId: string) {
  const safeStorage = storage ?? {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  };
  const agentStorageKey = agentsKey(workspaceId);
  const negativeRubricStorageKey = negativeRubricKey(workspaceId);

  return {
    list(): CustomEvaluationAgent[] {
      return parseAgents(safeStorage.getItem(agentStorageKey));
    },
    save(agents: CustomEvaluationAgent[]): void {
      safeStorage.setItem(agentStorageKey, JSON.stringify(agents.flatMap((agent) => normalizeAgent(agent))));
    },
    reset(): void {
      safeStorage.removeItem(agentStorageKey);
    },
    exportJson(): string {
      return JSON.stringify(this.list(), null, 2);
    },
    importJson(json: string): CustomEvaluationAgent[] {
      const agents = parseAgents(json);
      this.save(agents);
      return agents;
    },
    listNegativeRubricTechniques(): string[] {
      return parseStringList(safeStorage.getItem(negativeRubricStorageKey));
    },
    addNegativeRubricTechnique(technique: string): void {
      const normalized = technique.trim();
      if (!normalized) return;
      const current = this.listNegativeRubricTechniques();
      if (current.includes(normalized)) return;
      safeStorage.setItem(negativeRubricStorageKey, JSON.stringify([...current, normalized]));
    },
    resetNegativeRubricTechniques(): void {
      safeStorage.removeItem(negativeRubricStorageKey);
    },
  };
}
