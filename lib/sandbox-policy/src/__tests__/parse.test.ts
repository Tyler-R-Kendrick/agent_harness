import { describe, expect, it } from 'vitest';
import { parseSandboxPolicy } from '../parse';
import type { SandboxPolicy } from '../types';

const FULL_YAML = `network:
  allow: true
  allowedOrigins:
    - https://api.example.com
    - https://cdn.example.com
  allowedMethods:
    - GET
    - POST
  allowLocalhostHttp: false
  policy: restricted
  maxRequestBytes: 65536
  maxResponseBytes: 262144
  timeoutMs: 10000
limits:
  maxRuntimeMs: 15000
  maxStdoutBytes: 32768
  maxStderrBytes: 32768
  maxLogBytes: 32768
  maxEventCount: 256
  maxArtifactBytes: 65536
  maxWorkspaceBytes: 262144
  maxOutputBytes: 32768
  maxFileBytes: 16384
  maxTotalBytes: 262144
  defaultTimeoutMs: 5000
storage: skill-local
dom: false
enforcement:
  filesystem:
    readOnly:
      - /workspace
  seccomp: default
`;

const FULL_EXPECTED: SandboxPolicy = {
  network: {
    allow: true,
    allowedOrigins: ['https://api.example.com', 'https://cdn.example.com'],
    allowedMethods: ['GET', 'POST'],
    allowLocalhostHttp: false,
    policy: 'restricted',
    maxRequestBytes: 65536,
    maxResponseBytes: 262144,
    timeoutMs: 10000,
  },
  limits: {
    maxRuntimeMs: 15000,
    maxStdoutBytes: 32768,
    maxStderrBytes: 32768,
    maxLogBytes: 32768,
    maxEventCount: 256,
    maxArtifactBytes: 65536,
    maxWorkspaceBytes: 262144,
    maxOutputBytes: 32768,
    maxFileBytes: 16384,
    maxTotalBytes: 262144,
    defaultTimeoutMs: 5000,
  },
  storage: 'skill-local',
  dom: false,
  enforcement: {
    filesystem: { readOnly: ['/workspace'] },
    seccomp: 'default',
  },
};

describe('parseSandboxPolicy formats', () => {
  it('parses a valid YAML policy and an equivalent JSON policy to deep-equal results', () => {
    const fromYaml = parseSandboxPolicy(FULL_YAML, { format: 'yaml' });
    const fromJson = parseSandboxPolicy(JSON.stringify(FULL_EXPECTED), { format: 'json' });

    expect(fromYaml).toEqual(FULL_EXPECTED);
    expect(fromJson).toEqual(FULL_EXPECTED);
    expect(fromYaml).toEqual(fromJson);
  });

  it('defaults to auto format and parses JSON input when no options are given', () => {
    const policy = parseSandboxPolicy('{"storage":"none"}');
    expect(policy).toEqual({ storage: 'none' });
  });

  it('auto format falls back to YAML when JSON parsing fails', () => {
    const policy = parseSandboxPolicy('network:\n  allow: true\n');
    expect(policy).toEqual({ network: { allow: true } });
  });

  it('throws for invalid JSON when format is json', () => {
    expect(() => parseSandboxPolicy('{ not json', { format: 'json' })).toThrow('Sandbox policy must be valid JSON.');
  });

  it('throws for invalid YAML when format is yaml', () => {
    expect(() => parseSandboxPolicy('key: "unterminated', { format: 'yaml' })).toThrow('Sandbox policy must be valid YAML.');
  });
});

describe('parseSandboxPolicy root validation', () => {
  it('rejects a non-object (number) root', () => {
    expect(() => parseSandboxPolicy('42', { format: 'json' })).toThrow('Sandbox policy must be an object.');
  });

  it('rejects a null root', () => {
    expect(() => parseSandboxPolicy('null', { format: 'json' })).toThrow('Sandbox policy must be an object.');
  });

  it('rejects an array root', () => {
    expect(() => parseSandboxPolicy('[]', { format: 'json' })).toThrow('Sandbox policy must be an object.');
  });

  it('rejects unknown top-level keys', () => {
    expect(() => parseSandboxPolicy('{"bogus":1}', { format: 'json' })).toThrow('Sandbox policy has an unknown key "bogus".');
  });
});

describe('parseSandboxPolicy network validation', () => {
  it('rejects a non-object network', () => {
    expect(() => parseSandboxPolicy('{"network":"nope"}', { format: 'json' })).toThrow('Sandbox policy network must be an object.');
  });

  it('rejects a non-boolean network.allow', () => {
    expect(() => parseSandboxPolicy('{"network":{"allow":"yes"}}', { format: 'json' })).toThrow('network.allow must be a boolean');
  });

  it('rejects a non-array network.allowedOrigins', () => {
    expect(() => parseSandboxPolicy('{"network":{"allowedOrigins":"https://x"}}', { format: 'json' })).toThrow('network.allowedOrigins must be an array of strings');
  });

  it('rejects network.allowedOrigins containing a non-string', () => {
    expect(() => parseSandboxPolicy('{"network":{"allowedOrigins":["ok",1]}}', { format: 'json' })).toThrow('network.allowedOrigins must be an array of strings');
  });

  it('rejects a non-array network.allowedMethods', () => {
    expect(() => parseSandboxPolicy('{"network":{"allowedMethods":42}}', { format: 'json' })).toThrow('network.allowedMethods must be an array of strings');
  });

  it('rejects a non-boolean network.allowLocalhostHttp', () => {
    expect(() => parseSandboxPolicy('{"network":{"allowLocalhostHttp":1}}', { format: 'json' })).toThrow('network.allowLocalhostHttp must be a boolean');
  });

  it('accepts network.policy "deny"', () => {
    expect(parseSandboxPolicy('{"network":{"policy":"deny"}}', { format: 'json' })).toEqual({ network: { policy: 'deny' } });
  });

  it('rejects an invalid network.policy enum', () => {
    expect(() => parseSandboxPolicy('{"network":{"policy":"open"}}', { format: 'json' })).toThrow('network.policy must be "deny" or "restricted"');
  });

  it('rejects a negative network.maxRequestBytes', () => {
    expect(() => parseSandboxPolicy('{"network":{"maxRequestBytes":-1}}', { format: 'json' })).toThrow('network.maxRequestBytes must be a finite non-negative number');
  });

  it('rejects a non-number network.maxResponseBytes', () => {
    expect(() => parseSandboxPolicy('{"network":{"maxResponseBytes":"big"}}', { format: 'json' })).toThrow('network.maxResponseBytes must be a finite non-negative number');
  });

  it('rejects a non-finite network.timeoutMs', () => {
    expect(() => parseSandboxPolicy('network:\n  timeoutMs: .inf\n', { format: 'yaml' })).toThrow('network.timeoutMs must be a finite non-negative number');
  });

  it('accepts an empty network object (all fields absent)', () => {
    expect(parseSandboxPolicy('{"network":{}}', { format: 'json' })).toEqual({ network: {} });
  });

  it('rejects an unknown network key', () => {
    expect(() => parseSandboxPolicy('{"network":{"bogus":true}}', { format: 'json' })).toThrow('Sandbox policy network has an unknown key "bogus".');
  });
});

describe('parseSandboxPolicy limits, storage, dom, enforcement validation', () => {
  it('rejects a non-object limits', () => {
    expect(() => parseSandboxPolicy('{"limits":5}', { format: 'json' })).toThrow('Sandbox policy limits must be an object.');
  });

  it('rejects an invalid limits field', () => {
    expect(() => parseSandboxPolicy('{"limits":{"maxRuntimeMs":-3}}', { format: 'json' })).toThrow('limits.maxRuntimeMs must be a finite non-negative number');
  });

  it('accepts an empty limits object (all fields absent)', () => {
    expect(parseSandboxPolicy('{"limits":{}}', { format: 'json' })).toEqual({ limits: {} });
  });

  it('rejects an unknown limits key', () => {
    expect(() => parseSandboxPolicy('{"limits":{"bogus":1}}', { format: 'json' })).toThrow('Sandbox policy limits has an unknown key "bogus".');
  });

  it('accepts storage "none"', () => {
    expect(parseSandboxPolicy('{"storage":"none"}', { format: 'json' })).toEqual({ storage: 'none' });
  });

  it('accepts storage "skill-local"', () => {
    expect(parseSandboxPolicy('{"storage":"skill-local"}', { format: 'json' })).toEqual({ storage: 'skill-local' });
  });

  it('rejects an invalid storage value', () => {
    expect(() => parseSandboxPolicy('{"storage":"disk"}', { format: 'json' })).toThrow('storage must be "none" or "skill-local"');
  });

  it('accepts dom: false', () => {
    expect(parseSandboxPolicy('{"dom":false}', { format: 'json' })).toEqual({ dom: false });
  });

  it('rejects dom when not false', () => {
    expect(() => parseSandboxPolicy('{"dom":true}', { format: 'json' })).toThrow('dom must be false when present');
  });

  it('rejects a non-object enforcement', () => {
    expect(() => parseSandboxPolicy('{"enforcement":[]}', { format: 'json' })).toThrow('Sandbox policy enforcement must be an object.');
  });

  it('accepts a valid enforcement object', () => {
    expect(parseSandboxPolicy('{"enforcement":{"seccomp":"default"}}', { format: 'json' })).toEqual({ enforcement: { seccomp: 'default' } });
  });

  it('returns an empty policy for {}', () => {
    expect(parseSandboxPolicy('{}', { format: 'json' })).toEqual({});
  });
});
