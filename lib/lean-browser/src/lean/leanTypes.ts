export interface LeanDiagnostic {
  severity: 'information' | 'warning' | 'error';
  message: string;
  fileName?: string;
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
  raw?: unknown;
}
