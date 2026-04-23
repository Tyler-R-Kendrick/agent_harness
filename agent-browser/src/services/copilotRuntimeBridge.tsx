import type { DependencyList, ReactNode } from 'react';

export function CopilotRuntimeProvider({ children }: { children: ReactNode; runtimeUrl?: string }) {
  return <>{children}</>;
}

export function useCopilotReadable(_value: unknown, _dependencies?: DependencyList): void {
  return undefined;
}
