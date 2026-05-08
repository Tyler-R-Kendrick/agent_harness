import type { LeanDiagnostic } from './leanTypes';

function severityOf(raw: Record<string, unknown>): LeanDiagnostic['severity'] {
  const value = String(raw.severity ?? raw.type ?? 'information').toLowerCase();
  if (value.includes('error')) {
    return 'error';
  }
  if (value.includes('warn')) {
    return 'warning';
  }
  return 'information';
}

export function normalizeLeanDiagnostic(raw: unknown): LeanDiagnostic {
  if (typeof raw === 'string') {
    return { severity: 'error', message: raw, raw };
  }
  if (typeof raw === 'object' && raw !== null) {
    const record = raw as Record<string, unknown>;
    return {
      severity: severityOf(record),
      message: String(record.message ?? record.text ?? 'Lean diagnostic'),
      fileName: typeof record.fileName === 'string' ? record.fileName : undefined,
      startLine: typeof record.startLine === 'number' ? record.startLine : undefined,
      startColumn: typeof record.startColumn === 'number' ? record.startColumn : undefined,
      endLine: typeof record.endLine === 'number' ? record.endLine : undefined,
      endColumn: typeof record.endColumn === 'number' ? record.endColumn : undefined,
      raw,
    };
  }
  return { severity: 'information', message: 'Unknown Lean diagnostic', raw };
}

export function hasLeanErrors(diagnostics: LeanDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error');
}

export function formatLeanDiagnostics(diagnostics: LeanDiagnostic[]): string {
  if (diagnostics.length === 0) {
    return 'No Lean diagnostics.';
  }
  return diagnostics.map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`).join('\n');
}
