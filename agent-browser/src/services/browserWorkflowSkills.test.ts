import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BROWSER_WORKFLOW_SKILLS,
  buildBrowserWorkflowSkillPromptContext,
  createBrowserWorkflowSkillFile,
  discoverBrowserWorkflowSkills,
  installBrowserWorkflowSkill,
  isBrowserWorkflowSkillManifest,
  suggestBrowserWorkflowSkills,
} from './browserWorkflowSkills';
import type { WorkspaceFile } from '../types';

describe('browserWorkflowSkills', () => {
  it('validates manifests and rejects malformed permission, asset, and script shapes', () => {
    expect(isBrowserWorkflowSkillManifest(DEFAULT_BROWSER_WORKFLOW_SKILLS[0])).toBe(true);
    expect(isBrowserWorkflowSkillManifest({
      ...DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      schemaVersion: 2,
    })).toBe(false);
    expect(isBrowserWorkflowSkillManifest({
      ...DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      permissions: { tools: ['browser'], paths: [] },
    })).toBe(false);
    expect(isBrowserWorkflowSkillManifest({
      ...DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      assets: [{ path: 'output/screenshot.png' }],
    })).toBe(false);
    expect(isBrowserWorkflowSkillManifest({
      ...DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      scripts: [{ name: 'run' }],
    })).toBe(false);
  });

  it('creates deterministic workspace files for workflow skill manifests', () => {
    const file = createBrowserWorkflowSkillFile(
      DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      '2026-05-07T00:00:00.000Z',
    );

    expect(file.path).toBe('.agents/browser-workflows/visual-review/skill.json');
    expect(file.updatedAt).toBe('2026-05-07T00:00:00.000Z');
    expect(JSON.parse(file.content)).toMatchObject({
      schemaVersion: 1,
      id: 'visual-review',
      permissions: {
        tools: expect.arrayContaining(['browser-screenshot']),
        paths: expect.arrayContaining(['agent-browser/**']),
        network: [],
      },
    });
  });

  it('discovers valid workspace manifests and ignores invalid or unrelated files', () => {
    const file = createBrowserWorkflowSkillFile(
      DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      '2026-05-07T00:00:00.000Z',
    );
    const files: WorkspaceFile[] = [
      file,
      {
        path: '.agents/browser-workflows/bad/skill.json',
        content: '{ "schemaVersion": 1 }',
        updatedAt: file.updatedAt,
      },
      {
        path: '.agents/skills/not-a-browser-workflow/SKILL.md',
        content: '# ignored',
        updatedAt: file.updatedAt,
      },
    ];

    const skills = discoverBrowserWorkflowSkills(files);

    expect(skills.map((skill) => skill.id)).toEqual(['visual-review']);
  });

  it('installs workflow skill manifests immutably without duplicating existing files', () => {
    const installed = installBrowserWorkflowSkill(
      [],
      DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      '2026-05-07T00:00:00.000Z',
    );
    const reinstalled = installBrowserWorkflowSkill(
      installed,
      DEFAULT_BROWSER_WORKFLOW_SKILLS[0],
      '2026-05-07T01:00:00.000Z',
    );

    expect(installed).toHaveLength(1);
    expect(reinstalled).toHaveLength(1);
    expect(reinstalled).not.toBe(installed);
    expect(reinstalled[0].updatedAt).toBe('2026-05-07T01:00:00.000Z');
    expect(reinstalled[0].content).toContain('"schemaVersion": 1');
  });

  it('suggests skills from task text, ranks trigger matches, and renders prompt context', () => {
    const suggestions = suggestBrowserWorkflowSkills(
      'please review this UI visually and capture screenshots',
      DEFAULT_BROWSER_WORKFLOW_SKILLS,
      2,
    );

    expect(suggestions[0]).toMatchObject({
      id: 'visual-review',
      matchedTriggers: expect.arrayContaining(['visual', 'ui', 'screenshot']),
    });
    expect(buildBrowserWorkflowSkillPromptContext(suggestions)).toContain('## Browser Workflow Skills');
    expect(buildBrowserWorkflowSkillPromptContext(suggestions)).toContain('Visual review workflow');
    expect(buildBrowserWorkflowSkillPromptContext(suggestions)).toContain('Tools: browser-screenshot');
    expect(buildBrowserWorkflowSkillPromptContext([])).toBe('');
  });
});
