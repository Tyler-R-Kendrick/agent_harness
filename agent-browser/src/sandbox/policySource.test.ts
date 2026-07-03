import { describe, expect, it } from 'vitest';
import { DEFAULT_SANDBOX_POLICY_PATH, resolveSandboxPolicyFromFs } from './policySource';

const VALID_YAML = 'network:\n  allow: true\n  allowedOrigins:\n    - https://example.com\n';

describe('resolveSandboxPolicyFromFs', () => {
  it('returns undefined when disabled without reading', async () => {
    let read = false;
    const result = await resolveSandboxPolicyFromFs({
      enabled: false,
      reader: { readFile: () => { read = true; return VALID_YAML; } },
    });
    expect(result).toBeUndefined();
    expect(read).toBe(false);
  });

  it('reads, parses, and compiles a policy from the default path when enabled', async () => {
    let requestedPath = '';
    const result = await resolveSandboxPolicyFromFs({
      enabled: true,
      reader: {
        readFile: (path) => { requestedPath = path; return VALID_YAML; },
      },
    });
    expect(requestedPath).toBe(DEFAULT_SANDBOX_POLICY_PATH);
    expect(result?.browserOptions.allowNetwork).toBe(true);
    expect(result?.networkPolicy).toBe('restricted');
  });

  it('decodes Uint8Array content', async () => {
    const bytes = new TextEncoder().encode(VALID_YAML);
    const result = await resolveSandboxPolicyFromFs({
      enabled: true,
      reader: { readFile: () => bytes },
    });
    expect(result?.permissions.network).toBe(true);
  });

  it('honors a custom path', async () => {
    let requestedPath = '';
    await resolveSandboxPolicyFromFs({
      enabled: true,
      path: '.sandbox/custom.json',
      reader: { readFile: (path) => { requestedPath = path; return '{"storage":"skill-local"}'; } },
    });
    expect(requestedPath).toBe('.sandbox/custom.json');
  });

  it('fails open to undefined when the reader throws (missing file)', async () => {
    const result = await resolveSandboxPolicyFromFs({
      enabled: true,
      reader: { readFile: () => { throw new Error('ENOENT'); } },
    });
    expect(result).toBeUndefined();
  });

  it('fails open to undefined on invalid policy content', async () => {
    const result = await resolveSandboxPolicyFromFs({
      enabled: true,
      reader: { readFile: () => 'network:\n  policy: bogus\n' },
    });
    expect(result).toBeUndefined();
  });
});
