import { describe, expect, it } from 'vitest';
import {
  SettingsRegistry,
  createSettingsRegistry,
  formatSettingValue,
} from '../index.js';

describe('SettingsRegistry', () => {
  it('normalizes built-in setting types, defaults, loose values, and formatted output', () => {
    const registry = new SettingsRegistry({
      definitions: [
        { key: 'enabled', type: 'boolean', defaultValue: false },
        { key: 'label', type: 'string', defaultValue: 'Codex' },
        { key: 'maxTurns', type: 'integer', defaultValue: 3 },
        { key: 'metadata' },
        { key: 'mode', type: 'enum', values: ['auto', 'manual'], defaultValue: 'auto' },
        { key: 'temperature', type: 'number' },
      ],
      values: {
        metadata: { source: 'test' },
        temperature: '0.7',
      },
    });

    expect(registry.entries()).toEqual({
      enabled: false,
      label: 'Codex',
      maxTurns: 3,
      metadata: { source: 'test' },
      mode: 'auto',
      temperature: 0.7,
    });
    expect(registry.set('enabled', 'true')).toBe(true);
    expect(registry.set('enabled', 'false')).toBe(false);
    expect(registry.set('label', 123)).toBe('123');
    expect(registry.set('mode', 'manual')).toBe('manual');
    expect(registry.set('loose', ['kept'])).toEqual(['kept']);
    expect(registry.format('missing')).toBe('undefined');
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.getDefinition('missing')).toBeUndefined();
    expect(registry.listDefinitions().map((definition) => definition.key)).toEqual([
      'enabled',
      'label',
      'maxTurns',
      'metadata',
      'mode',
      'temperature',
    ]);
  });

  it('rejects invalid values and duplicate setting metadata', () => {
    const registry = new SettingsRegistry();

    expect(() => registry.registerType({ id: 'json', parse: (value) => value })).toThrow(/already registered/i);
    expect(() => registry.registerDefinition({ key: 'bad', type: 'missing' })).toThrow(/unknown setting type/i);

    registry.registerDefinition({ key: 'enabled', type: 'boolean' });
    registry.registerDefinition({ key: 'emptyMode', type: 'enum' });
    registry.registerDefinition({ key: 'limit', type: 'number' });
    registry.registerDefinition({ key: 'mode', type: 'enum', values: ['auto'] });

    expect(() => registry.registerDefinition({ key: 'enabled', type: 'boolean' })).toThrow(/already registered/i);
    expect(() => registry.set('enabled', 'sometimes')).toThrow(/true or false/i);
    expect(() => registry.set('emptyMode', 'auto')).toThrow(/one of/i);
    expect(() => registry.set('limit', 'many')).toThrow(/finite number/i);
    expect(() => registry.set('mode', 'manual')).toThrow(/auto/i);
  });

  it('supports custom setting types and registry factories', () => {
    const existing = new SettingsRegistry({
      definitions: [{ key: 'maxTurns', type: 'integer' }],
    });
    const reused = createSettingsRegistry(existing, { maxTurns: '5' });
    const configured = createSettingsRegistry({
      types: [
        {
          id: 'upper',
          parse: (value) => String(value).toUpperCase(),
        },
      ],
      definitions: [{ key: 'codename', type: 'upper' }],
      values: { codename: 'sparrow' },
    }, { fallback: 'present' });
    const loose = createSettingsRegistry({ theme: 'dark' });
    const empty = createSettingsRegistry(null as never);

    expect(reused).toBe(existing);
    expect(reused.get('maxTurns')).toBe(5);
    expect(configured.entries()).toEqual({ codename: 'SPARROW', fallback: 'present' });
    expect(loose.entries()).toEqual({ theme: 'dark' });
    expect(empty.entries()).toEqual({});
    expect(formatSettingValue('plain')).toBe('plain');
    expect(formatSettingValue(undefined)).toBe('undefined');
  });

  it('applies fallback values to existing registries without replacing explicit settings', () => {
    const existing = new SettingsRegistry({
      definitions: [
        { key: 'label', type: 'string' },
        { key: 'maxTurns', type: 'integer', defaultValue: 3 },
        { key: 'theme', type: 'enum', values: ['light', 'dark'], defaultValue: 'light' },
      ],
      values: { maxTurns: '7' },
    });

    const reused = createSettingsRegistry(existing, {
      label: 'fallback label',
      maxTurns: '5',
      theme: 'dark',
    });

    expect(reused).toBe(existing);
    expect(reused.entries()).toEqual({
      label: 'fallback label',
      maxTurns: 7,
      theme: 'dark',
    });
  });

  it('returns defensive copies of setting definitions', () => {
    const registry = new SettingsRegistry({
      definitions: [{ key: 'mode', type: 'enum', values: ['auto'], defaultValue: 'auto' }],
    });
    const definition = registry.getDefinition('mode');
    (definition?.values as unknown[] | undefined)?.push('manual');

    expect(registry.getDefinition('mode')).toEqual({
      key: 'mode',
      type: 'enum',
      values: ['auto'],
      defaultValue: 'auto',
    });
  });
});
