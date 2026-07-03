import { describe, expect, it } from 'vitest';
import { compileSandboxPolicy, SANDBOX_POLICY_UNSUPPORTED_ENFORCEMENT_NOTE } from '../compile';
import type { CompiledSandboxPolicy, SandboxPolicy } from '../types';

describe('compileSandboxPolicy defaults', () => {
  it('compiles an empty policy to safe, network-denied defaults', () => {
    const compiled = compileSandboxPolicy({});
    const expected: CompiledSandboxPolicy = {
      browserOptions: { allowNetwork: false },
      networkPolicy: 'deny',
      limits: {},
      permissions: { network: false, storage: 'none', dom: false },
      unsupportedDirectives: [],
    };
    expect(compiled).toEqual(expected);
  });

  it('derives networkPolicy "restricted" when network.allow is true and no explicit policy is set', () => {
    const compiled = compileSandboxPolicy({ network: { allow: true } });
    expect(compiled.networkPolicy).toBe('restricted');
    expect(compiled.browserOptions.allowNetwork).toBe(true);
    expect(compiled.permissions.network).toBe(true);
    // No network sub-fields → no browserOptions.network object.
    expect(compiled.browserOptions.network).toBeUndefined();
  });

  it('derives networkPolicy "deny" when network is present but allow is false', () => {
    const compiled = compileSandboxPolicy({ network: { allow: false } });
    expect(compiled.networkPolicy).toBe('deny');
    expect(compiled.browserOptions.allowNetwork).toBe(false);
    expect(compiled.permissions.network).toBe(false);
  });

  it('honors an explicit network.policy even when allow is true', () => {
    const compiled = compileSandboxPolicy({ network: { allow: true, policy: 'deny' } });
    expect(compiled.networkPolicy).toBe('deny');
    expect(compiled.browserOptions.allowNetwork).toBe(true);
  });
});

describe('compileSandboxPolicy full mapping', () => {
  const policy: SandboxPolicy = {
    network: {
      allow: true,
      allowedOrigins: ['https://api.example.com'],
      allowedMethods: ['GET', 'POST'],
      allowLocalhostHttp: true,
      maxRequestBytes: 65536,
      maxResponseBytes: 262144,
      timeoutMs: 10000,
    },
    limits: {
      maxRuntimeMs: 15000,
      maxStdoutBytes: 1,
      maxStderrBytes: 2,
      maxLogBytes: 3,
      maxEventCount: 4,
      maxArtifactBytes: 5,
      maxWorkspaceBytes: 6,
      maxOutputBytes: 32768,
      maxFileBytes: 16384,
      maxTotalBytes: 262144,
      defaultTimeoutMs: 5000,
    },
    storage: 'skill-local',
    dom: false,
    enforcement: {
      seccomp: 'default',
      filesystem: { readOnly: ['/workspace'] },
      inferenceRouting: { model: 'local' },
    },
  };

  it('maps every field into the compiled shape', () => {
    const compiled = compileSandboxPolicy(policy);
    const expected: CompiledSandboxPolicy = {
      browserOptions: {
        allowNetwork: true,
        network: {
          allowedOrigins: ['https://api.example.com'],
          allowedMethods: ['GET', 'POST'],
          allowLocalhostHttp: true,
          maxRequestBytes: 65536,
          maxResponseBytes: 262144,
          timeoutMs: 10000,
        },
        maxOutputBytes: 32768,
        maxFileBytes: 16384,
        maxTotalBytes: 262144,
        defaultTimeoutMs: 5000,
      },
      networkPolicy: 'restricted',
      limits: {
        maxRuntimeMs: 15000,
        maxStdoutBytes: 1,
        maxStderrBytes: 2,
        maxLogBytes: 3,
        maxEventCount: 4,
        maxArtifactBytes: 5,
        maxWorkspaceBytes: 6,
      },
      permissions: { network: true, storage: 'skill-local', dom: false },
      unsupportedDirectives: ['filesystem', 'inferenceRouting', 'seccomp'],
    };
    expect(compiled).toEqual(expected);
  });

  it('sorts unsupportedDirectives collected from enforcement keys', () => {
    const compiled = compileSandboxPolicy(policy);
    expect(compiled.unsupportedDirectives).toEqual(['filesystem', 'inferenceRouting', 'seccomp']);
  });
});

describe('SANDBOX_POLICY_UNSUPPORTED_ENFORCEMENT_NOTE', () => {
  it('describes that enforcement directives are server-tier-only', () => {
    expect(SANDBOX_POLICY_UNSUPPORTED_ENFORCEMENT_NOTE).toContain('server-tier-only');
    expect(SANDBOX_POLICY_UNSUPPORTED_ENFORCEMENT_NOTE).toContain('unsupportedDirectives');
  });
});
