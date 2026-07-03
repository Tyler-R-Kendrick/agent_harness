import {
  compileSandboxPolicy,
  parseSandboxPolicy,
  type CompiledSandboxPolicy,
} from '@agent-harness/sandbox-policy';

/** Conventional workspace path a sandbox policy document is read from. */
export const DEFAULT_SANDBOX_POLICY_PATH = '.sandbox/policy.yaml';

export interface SandboxPolicyReader {
  readFile(path: string): Promise<string | Uint8Array> | string | Uint8Array;
}

export interface ResolveSandboxPolicyOptions {
  enabled: boolean | undefined;
  reader: SandboxPolicyReader;
  path?: string;
}

/**
 * Resolve a compiled sandbox policy from a workspace file, or `undefined`.
 *
 * Phase 1 opt-in: returns `undefined` when the flag is off (default), so the
 * sandbox uses its built-in adapter defaults. Fail-open: a missing file or any
 * parse/compile error also yields `undefined` rather than blocking execution.
 */
export async function resolveSandboxPolicyFromFs(
  options: ResolveSandboxPolicyOptions,
): Promise<CompiledSandboxPolicy | undefined> {
  if (!options.enabled) {
    return undefined;
  }
  const path = options.path ?? DEFAULT_SANDBOX_POLICY_PATH;
  try {
    const raw = await options.reader.readFile(path);
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    return compileSandboxPolicy(parseSandboxPolicy(text, { format: 'auto' }));
  } catch (err) {
    console.warn(`[sandbox-policy] failed to load policy from "${path}"; using defaults.`, err);
    return undefined;
  }
}
