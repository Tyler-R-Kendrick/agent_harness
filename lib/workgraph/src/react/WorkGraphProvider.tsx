import { createContext, useContext, type ReactNode } from 'react';
import type { WorkGraphExternalStore } from './hooks.js';

const WorkGraphContext = createContext<WorkGraphExternalStore | null>(null);

export function WorkGraphProvider({ children, store }: { children: ReactNode; store: WorkGraphExternalStore }) {
  return <WorkGraphContext.Provider value={store}>{children}</WorkGraphContext.Provider>;
}

export function useWorkGraphStore(): WorkGraphExternalStore {
  const store = useContext(WorkGraphContext);
  if (!store) throw new Error('WorkGraphProvider is missing');
  return store;
}
