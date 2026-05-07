import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE_SKILL_POLICY_STATE,
  buildWorkspaceSkillPolicyInventory,
  buildWorkspaceSkillPolicyPromptContext,
  isPathAllowedBySkill,
  isToolAllowedBySkill,
  isWorkspaceSkillPolicyState,
  publishWorkspaceSkillDraft,
  searchWorkspaceFilesWithinPolicy,
} from './workspaceSkillPolicies';
import type { WorkspaceFile } from '../types';

describe('workspaceSkillPolicies', () => {
  it('derives versioned package inventory with least-privilege helper status', () => {
    const inventory = buildWorkspaceSkillPolicyInventory(DEFAULT_WORKSPACE_SKILL_POLICY_STATE);

    expect(inventory.enabled).toBe(true);
    expect(inventory.enforceLeastPrivilege).toBe(true);
    expect(inventory.packageCount).toBe(2);
    expect(inventory.draftPackageCount).toBe(1);
    expect(inventory.publishedPackageCount).toBe(1);
    expect(inventory.toolScopeCount).toBeGreaterThan(2);
    expect(inventory.externalPathCount).toBe(2);
    expect(inventory.packageRows.map((row) => row.id)).toEqual([
      'team-reviewer',
      'release-runner',
    ]);
    expect(inventory.helperRows).toContainEqual({
      id: 'regex-grep',
      label: 'Policy-aware regex grep',
      enabled: true,
      packageCount: 2,
      summary: 'Searches only files allowed by each skill package path scope.',
    });
    expect(inventory.warnings).toEqual([]);
  });

  it('validates persisted state and rejects malformed lifecycle scopes', () => {
    expect(isWorkspaceSkillPolicyState(DEFAULT_WORKSPACE_SKILL_POLICY_STATE)).toBe(true);
    expect(isWorkspaceSkillPolicyState({
      ...DEFAULT_WORKSPACE_SKILL_POLICY_STATE,
      packages: [{ id: 'bad', status: 'published' }],
    })).toBe(false);
    expect(isWorkspaceSkillPolicyState({
      ...DEFAULT_WORKSPACE_SKILL_POLICY_STATE,
      helpers: [{ id: 'regex-grep', enabled: 'yes' }],
    })).toBe(false);
  });

  it('publishes drafts immutably and stamps the selected package', () => {
    const next = publishWorkspaceSkillDraft(
      DEFAULT_WORKSPACE_SKILL_POLICY_STATE,
      'team-reviewer',
      new Date('2026-05-06T12:00:00.000Z'),
    );
    const original = DEFAULT_WORKSPACE_SKILL_POLICY_STATE.packages.find((pkg) => pkg.id === 'team-reviewer');
    const published = next.packages.find((pkg) => pkg.id === 'team-reviewer');

    expect(original?.status).toBe('draft');
    expect(published).toMatchObject({
      id: 'team-reviewer',
      status: 'published',
      publishedAt: '2026-05-06T12:00:00.000Z',
    });
    expect(buildWorkspaceSkillPolicyInventory(next).draftPackageCount).toBe(0);
    expect(publishWorkspaceSkillDraft(next, 'missing')).toBe(next);
  });

  it('checks path and tool scopes before helper search', () => {
    const teamReviewer = DEFAULT_WORKSPACE_SKILL_POLICY_STATE.packages[0];
    const releaseRunner = DEFAULT_WORKSPACE_SKILL_POLICY_STATE.packages[1];
    const files: WorkspaceFile[] = [
      {
        path: 'agent-browser/src/App.tsx',
        content: 'Policy-aware regex grep renders here.',
        updatedAt: '2026-05-06T12:00:00.000Z',
      },
      {
        path: 'scripts/deploy-production.ps1',
        content: 'Policy-aware regex grep must not inspect this for team-reviewer.',
        updatedAt: '2026-05-06T12:00:00.000Z',
      },
      {
        path: 'docs/security/review.md',
        content: 'Least privilege review checklist.',
        updatedAt: '2026-05-06T12:00:00.000Z',
      },
    ];

    expect(isToolAllowedBySkill(teamReviewer, 'read-file')).toBe(true);
    expect(isToolAllowedBySkill(teamReviewer, 'deploy-production')).toBe(false);
    expect(isPathAllowedBySkill(teamReviewer, 'agent-browser/src/App.tsx')).toBe(true);
    expect(isPathAllowedBySkill(teamReviewer, 'scripts/deploy-production.ps1')).toBe(false);
    expect(isPathAllowedBySkill(releaseRunner, 'scripts/deploy-production.ps1')).toBe(true);

    const matches = searchWorkspaceFilesWithinPolicy(files, /policy-aware/i, teamReviewer);
    expect(matches).toEqual([{
      path: 'agent-browser/src/App.tsx',
      line: 1,
      preview: 'Policy-aware regex grep renders here.',
    }]);
  });

  it('renders concise prompt context for enabled policies only', () => {
    const context = buildWorkspaceSkillPolicyPromptContext(
      buildWorkspaceSkillPolicyInventory(DEFAULT_WORKSPACE_SKILL_POLICY_STATE),
    );

    expect(context).toContain('## Versioned Workspace Skills');
    expect(context).toContain('Least-privilege enforcement: enabled');
    expect(context).toContain('team-reviewer@0.1.0 draft');
    expect(context).toContain('Policy-aware regex grep: enabled');
    expect(context).toContain('External allowlist: C:\\src\\agent-harness, C:\\tmp\\agent-browser-evidence');

    expect(buildWorkspaceSkillPolicyPromptContext({
      ...buildWorkspaceSkillPolicyInventory(DEFAULT_WORKSPACE_SKILL_POLICY_STATE),
      enabled: false,
    })).toBe('');
  });
});
