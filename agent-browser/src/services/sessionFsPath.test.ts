import { describe, expect, it } from 'vitest';
import {
  buildRenamedSessionFsPath,
  buildSessionFsChildPath,
  normalizeSessionFsEntryName,
  normalizeSessionFsPath,
} from './sessionFsPath';

describe('sessionFsPath', () => {
  it('normalizes absolute paths', () => {
    expect(normalizeSessionFsPath(' /workspace/demo/ ')).toBe('/workspace/demo');
  });

  it('rejects relative paths', () => {
    expect(() => normalizeSessionFsPath('workspace/demo')).toThrow('absolute');
  });

  it('rejects root modifications by default', () => {
    expect(() => normalizeSessionFsPath('/')).toThrow('root cannot be modified');
  });

  it('allows root when explicitly requested', () => {
    expect(normalizeSessionFsPath('/', { allowRoot: true })).toBe('/');
  });

  it('rejects traversal segments in paths', () => {
    expect(() => normalizeSessionFsPath('/workspace/../secret')).toThrow('traversal');
  });

  it('rejects backslashes in paths', () => {
    expect(() => normalizeSessionFsPath('/workspace\\secret')).toThrow('backslashes');
  });

  it('normalizes entry names', () => {
    expect(normalizeSessionFsEntryName(' notes.md ')).toBe('notes.md');
  });

  it('rejects empty entry names', () => {
    expect(() => normalizeSessionFsEntryName('   ')).toThrow('cannot be empty');
  });

  it('rejects traversal entry names', () => {
    expect(() => normalizeSessionFsEntryName('..')).toThrow('traversal');
  });

  it('rejects separators in entry names', () => {
    expect(() => normalizeSessionFsEntryName('nested/file.txt')).toThrow('path separators');
  });

  it('builds safe child paths', () => {
    expect(buildSessionFsChildPath('/workspace', 'notes.md')).toBe('/workspace/notes.md');
  });

  it('rejects unsafe child names', () => {
    expect(() => buildSessionFsChildPath('/workspace', '../notes.md')).toThrow('traversal');
  });

  it('builds renamed paths within the same parent directory', () => {
    expect(buildRenamedSessionFsPath('/workspace/notes.md', 'ideas.md')).toBe('/workspace/ideas.md');
  });

  it('rejects renames to unsafe names', () => {
    expect(() => buildRenamedSessionFsPath('/workspace/notes.md', '../ideas.md')).toThrow('traversal');
  });
});
