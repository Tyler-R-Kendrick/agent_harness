import type {
  WorkspaceMcpUserContextMemory,
  WorkspaceMcpUserContextMemoryResult,
} from 'agent-browser-mcp';

export const USER_CONTEXT_MEMORY_STORAGE_KEY = 'agent-browser:user-context-memory:v1';

type MemoryStore = Record<string, WorkspaceMcpUserContextMemory[]>;

function readStore(): MemoryStore {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(USER_CONTEXT_MEMORY_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as MemoryStore : {};
  } catch {
    return {};
  }
}

function writeStore(store: MemoryStore): void {
  window.localStorage.setItem(USER_CONTEXT_MEMORY_STORAGE_KEY, JSON.stringify(store));
}

export function searchUserContextMemory(
  workspaceName: string,
  query: string | undefined,
  limit: number,
): WorkspaceMcpUserContextMemoryResult {
  const entries = readStore()[workspaceName] ?? [];
  const normalizedQuery = query?.trim().toLowerCase() ?? '';
  const memories = normalizedQuery
    ? entries.filter((entry) => (
      entry.id.toLowerCase().includes(normalizedQuery)
      || entry.label.toLowerCase().includes(normalizedQuery)
      || entry.value.toLowerCase().includes(normalizedQuery)
    ))
    : entries;
  return {
    status: memories.length ? 'found' : 'empty',
    ...(query ? { query } : {}),
    memories: memories.slice(0, Math.max(1, limit)),
  };
}

export function upsertUserContextMemory(
  workspaceName: string,
  entry: Pick<WorkspaceMcpUserContextMemory, 'id' | 'label' | 'value' | 'source'>,
): WorkspaceMcpUserContextMemory {
  const store = readStore();
  const entries = store[workspaceName] ?? [];
  const nextEntry: WorkspaceMcpUserContextMemory = {
    ...entry,
    updatedAt: new Date().toISOString(),
  };
  store[workspaceName] = [
    nextEntry,
    ...entries.filter((candidate) => candidate.id !== entry.id),
  ];
  writeStore(store);
  return nextEntry;
}
