import type { FormalClaim } from '../schemas';

export interface LeanTheoremBuildOptions {
  imports?: string[];
  assumptions?: string[];
  theoremPrefix?: string;
}

export function sanitizeLeanIdentifier(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const fallback = cleaned || 'claim';
  return /^[A-Za-z_]/.test(fallback) ? fallback : `claim_${fallback}`;
}

function renderProof(proof: string | undefined): string[] {
  if (!proof?.trim()) {
    return [' first', ' | rfl', ' | simp', ' | trivial'];
  }

  const withoutLeadingBy = proof.trim().replace(/^by\b\s*/u, '');
  return withoutLeadingBy.split(/\r?\n/u).map((line) => `  ${line.trim()}`);
}

function renderImports(imports: string[] | undefined): string[] {
  return (imports ?? []).map((item) => item.trim()).filter(Boolean).map((item) => `import ${item}`);
}

export function buildLeanTheoremFile(
  claim: FormalClaim,
  options: LeanTheoremBuildOptions = {},
): string {
  if (claim.formalization_target !== 'lean') {
    throw new Error('Claim is not targeted at Lean.');
  }
  if (!claim.formal_expression?.trim()) {
    throw new Error('No Lean formal expression provided.');
  }

  const theoremName = `${options.theoremPrefix ?? 'claim'}_${sanitizeLeanIdentifier(claim.claim_id)}`;
  const assumptions = options.assumptions?.length ? ` ${options.assumptions.map((item) => `(${item})`).join(' ')}` : '';
  const header = `theorem ${theoremName}${assumptions} : ${claim.formal_expression.trim()} := by`;
  const imports = renderImports(options.imports);
  const lines = [...imports, ...(imports.length ? [''] : []), 'set_option autoImplicit false', '', header, ...renderProof(claim.proof)];

  return lines.join('\n');
}
