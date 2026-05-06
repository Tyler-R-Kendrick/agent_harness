import { describe, expect, it } from 'vitest';

import { resolveWorkflow } from './resolve-workflow';

describe('resolveWorkflow', () => {
  it('defaults to inspecting the active workspace', () => {
    expect(resolveWorkflow('look around the workspace').id).toBe('inspect-workspace');
  });

  it('detects default skill editing tasks', () => {
    expect(resolveWorkflow('edit the default skill in the workspace').id).toBe('edit-default-skill');
  });

  it('detects runtime inspection tasks', () => {
    expect(resolveWorkflow('inspect runtime session output').id).toBe('inspect-runtime-output');
  });

  it('detects durable-file linking tasks', () => {
    expect(resolveWorkflow('symlink a durable file into runtime').id).toBe('link-durable-file');
  });
});