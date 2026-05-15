import { describe, expect, it } from 'vitest';
import { createSkillRegistry, registerSkillPacks } from './skillRegistry';

describe('skillRegistry', () => {
  it('loads core and extension packs and exposes introspection', () => {
    const registry = createSkillRegistry(
      [{ id: 'core-pack', version: '1.0.0', skills: [{ id: 'core.search' }] }],
      { extensionPacks: [{ id: 'ext-pack', version: '1.1.0', skills: [{ id: 'ext.lint', enabled: false }] }] },
    );

    expect(registry.diagnostics).toEqual([]);
    expect(registry.skills).toEqual([
      { id: 'core.search', enabled: true, source: 'core', packId: 'core-pack', packVersion: '1.0.0' },
      { id: 'ext.lint', enabled: false, source: 'extension', packId: 'ext-pack', packVersion: '1.1.0' },
    ]);
    expect(registry.bySource.core.map((skill) => skill.id)).toEqual(['core.search']);
    expect(registry.bySource.extension.map((skill) => skill.id)).toEqual(['ext.lint']);
  });

  it('returns structured diagnostics for invalid manifests and unsupported policies', () => {
    const result = registerSkillPacks([
      { source: 'core', manifest: { version: '1.0.0', skills: [] } },
      { source: 'extension', manifest: { id: 'pack', version: '1.0.0', policy: 'strict', skills: [] } },
      { source: 'extension', manifest: { id: 'pack2', version: '1.0.0', skills: [{ id: 7 }] } },
    ]);

    expect(result.skills).toEqual([]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-field', path: 'id' }),
      expect.objectContaining({ code: 'unsupported-policy', path: 'policy' }),
      expect.objectContaining({ code: 'invalid-field-type', path: 'skills[0].id' }),
    ]));
  });



  it('rejects non-object manifests and malformed skill entries', () => {
    const result = registerSkillPacks([
      { source: 'core', manifest: 'nope' },
      {
        source: 'extension',
        manifest: {
          id: 'pack-valid',
          version: '1.0.0',
          policy: 'allow',
          skills: [null, { id: '   ' }, { id: 'skill.good', enabled: 'yes' }, { id: 'skill.ok', enabled: true }],
        },
      },
    ]);

    expect(result.skills).toEqual([
      { id: 'skill.ok', enabled: true, source: 'extension', packId: 'pack-valid', packVersion: '1.0.0' },
    ]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid-field-type', path: 'manifest' }),
      expect.objectContaining({ code: 'invalid-field-type', path: 'skills[0]' }),
      expect.objectContaining({ code: 'invalid-field-type', path: 'skills[1].id' }),
      expect.objectContaining({ code: 'invalid-field-type', path: 'skills[2].enabled' }),
    ]));
  });

  it('rejects duplicate pack ids and duplicate skill ids', () => {
    const result = registerSkillPacks([
      { source: 'core', manifest: { id: 'shared-pack', version: '1.0.0', skills: [{ id: 'skill.a' }] } },
      { source: 'extension', manifest: { id: 'shared-pack', version: '1.1.0', skills: [{ id: 'skill.b' }] } },
      { source: 'extension', manifest: { id: 'other-pack', version: '1.0.0', skills: [{ id: 'skill.a' }] } },
    ]);

    expect(result.skills).toEqual([
      { id: 'skill.a', enabled: true, source: 'core', packId: 'shared-pack', packVersion: '1.0.0' },
    ]);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate-pack-id' }),
      expect.objectContaining({ code: 'duplicate-skill-id' }),
    ]));
  });
});
