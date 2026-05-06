import { describe, expect, it } from 'vitest';
import { parseSkillManifest } from '../skillManifest';

describe('parseSkillManifest', () => {
  it('rejects manifests that request DOM permission', () => {
    expect(() => parseSkillManifest(JSON.stringify({
      id: 'hello',
      runtime: 'quickjs',
      entry: '/skills/hello/src/index.js',
      permissions: { dom: true },
    }))).toThrow(/DOM/i);
  });

  it('defaults network to false and storage to none', () => {
    expect(parseSkillManifest(new TextEncoder().encode(JSON.stringify({
      id: 'hello',
      runtime: 'quickjs',
      entry: '/skills/hello/src/index.js',
    })))).toEqual({
      id: 'hello',
      runtime: 'quickjs',
      entry: '/skills/hello/src/index.js',
      permissions: {
        network: false,
        storage: 'none',
        dom: false,
      },
    });
  });

  it('rejects network permission unless explicitly allowed by the provider policy', () => {
    const manifest = JSON.stringify({
      id: 'net',
      runtime: 'quickjs',
      entry: '/skills/net/src/index.js',
      permissions: { network: true, storage: 'skill-local', dom: false },
      exports: ['default'],
    });

    expect(() => parseSkillManifest(manifest)).toThrow(/network/i);
    expect(parseSkillManifest(manifest, { allowNetwork: true })).toEqual({
      id: 'net',
      runtime: 'quickjs',
      entry: '/skills/net/src/index.js',
      permissions: {
        network: true,
        storage: 'skill-local',
        dom: false,
      },
      exports: ['default'],
    });
  });

  it('rejects invalid JSON, unsupported runtimes, and malformed exports', () => {
    expect(() => parseSkillManifest('{')).toThrow(/valid JSON/i);
    expect(() => parseSkillManifest('null')).toThrow(/object/i);
    expect(() => parseSkillManifest(JSON.stringify({
      runtime: 'quickjs',
      entry: '/skills/bad/src/index.js',
      permissions: { dom: false },
    }))).toThrow(/id/i);
    expect(() => parseSkillManifest(JSON.stringify({
      id: 'bad',
      runtime: 'node',
      entry: '/skills/bad/src/index.js',
      permissions: { dom: false },
    }))).toThrow(/quickjs/i);
    expect(() => parseSkillManifest(JSON.stringify({
      id: 'bad',
      runtime: 'quickjs',
      permissions: { dom: false },
    }))).toThrow(/entry/i);
    expect(() => parseSkillManifest(JSON.stringify({
      id: 'bad',
      runtime: 'quickjs',
      entry: '/skills/bad/src/index.js',
      permissions: { dom: false, storage: 'global' },
    }))).toThrow(/storage/i);
    expect(() => parseSkillManifest(JSON.stringify({
      id: 'bad',
      runtime: 'quickjs',
      entry: '/skills/bad/src/index.js',
      permissions: { dom: false },
      exports: ['ok', 1],
    }))).toThrow(/exports/i);
  });
});
