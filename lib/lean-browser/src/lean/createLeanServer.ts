import { normalizeLeanDiagnostic } from './diagnostics';
import type { LeanDiagnostic } from './leanTypes';

export interface BrowserLeanServerOptions {
  baseUrl?: string;
  memoryMB?: number;
  dbName?: string;
}

export interface BrowserLeanServer {
  connect(): Promise<void>;
  sync(filename: string, code: string): Promise<void>;
  getDiagnostics(filename: string): Promise<LeanDiagnostic[]>;
  dispose(): Promise<void>;
}

export async function createLeanServer(options: BrowserLeanServerOptions = {}): Promise<BrowserLeanServer> {
  const files = new Map<string, string>();
  const baseUrl = options.baseUrl ?? '/lean';

  return {
    async connect(): Promise<void> {
      if (typeof Worker === 'undefined') {
        throw new Error(`Lean browser worker unavailable for ${baseUrl}.`);
      }
    },
    async sync(filename: string, code: string): Promise<void> {
      files.set(filename, code);
    },
    async getDiagnostics(filename: string): Promise<LeanDiagnostic[]> {
      const code = files.get(filename);
      if (code === undefined) {
        return [normalizeLeanDiagnostic({ severity: 'error', message: `No virtual Lean file synced: ${filename}` })];
      }
      return [];
    },
    async dispose(): Promise<void> {
      files.clear();
    },
  };
}
