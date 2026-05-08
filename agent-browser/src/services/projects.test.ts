import { describe, expect, it } from 'vitest';
import type { TreeNode, WorkspaceFile } from '../types';
import {
  createBrowserTab,
  createInitialRoot,
  createWorkspaceNode,
  getWorkspaceCategory,
} from './workspaceTree';
import {
  createProjectWorkspace,
  listProjectSummaries,
  nextProjectColor,
  nextProjectName,
  summarizeProject,
} from './projects';

describe('projects', () => {
  it('summarizes workspace-backed projects for the project switcher', () => {
    const root = createInitialRoot();
    const workspaceFiles: Record<string, WorkspaceFile[]> = {
      'ws-research': [{ path: 'skills/research.md', content: 'notes', updatedAt: '2026-05-08T20:00:00Z' }],
    };

    expect(listProjectSummaries(root, 'ws-build', workspaceFiles)).toEqual([
      expect.objectContaining({
        id: 'ws-research',
        name: 'Research',
        isActive: false,
        sessionCount: 1,
        browserPageCount: 2,
        fileCount: 1,
        memoryMB: 253,
        previewItems: ['Hugging Face', 'Transformers.js'],
      }),
      expect.objectContaining({
        id: 'ws-build',
        name: 'Build',
        isActive: true,
        sessionCount: 1,
        browserPageCount: 1,
        fileCount: 0,
        memoryMB: 44,
        previewItems: ['CopilotKit docs'],
      }),
    ]);
  });

  it('creates new projects with the same mounted session dashboard contract as workspaces', () => {
    const existingProject = createWorkspaceNode({
      id: 'ws-project-3',
      name: 'Project 3',
      color: '#f59e0b',
      browserTabs: [],
    });
    const root: TreeNode = {
      id: 'root',
      name: 'Root',
      type: 'root',
      children: [
        createWorkspaceNode({ id: 'ws-a', name: 'Research', color: '#60a5fa', browserTabs: [] }),
        createWorkspaceNode({ id: 'ws-b', name: 'Build', color: '#34d399', browserTabs: [] }),
        existingProject,
      ],
    };

    expect(nextProjectName(root)).toBe('Project 4');
    expect(nextProjectColor(root)).toBe('#f472b6');

    const created = createProjectWorkspace({
      root,
      id: 'ws-created',
      color: '#f472b6',
    });
    const sessionId = getWorkspaceCategory(created.workspace, 'session')?.children?.[0]?.id;

    expect(created.workspace).toEqual(expect.objectContaining({
      id: 'ws-created',
      name: 'Project 4',
      color: '#f472b6',
      type: 'workspace',
    }));
    expect(created.viewState).toEqual(expect.objectContaining({
      dashboardOpen: true,
      activeSessionIds: [],
      mountedSessionFsIds: [sessionId],
    }));
  });

  it('counts project files from both the workspace file store and file tree nodes', () => {
    const workspace = createWorkspaceNode({
      id: 'ws-files',
      name: 'Files',
      color: '#60a5fa',
      browserTabs: [createBrowserTab('Docs', 'https://example.test/docs', 'warm', 8)],
    });
    const fileCategory = getWorkspaceCategory(workspace, 'files');
    const workspaceWithTreeFiles: TreeNode = {
      ...workspace,
      children: (workspace.children ?? []).map((child) => child.id === fileCategory?.id
        ? {
            ...child,
            children: [{ id: 'file-1', name: 'AGENTS.md', type: 'file', filePath: 'AGENTS.md' }],
          }
        : child),
    };

    expect(summarizeProject(workspaceWithTreeFiles, 'ws-files', [
      { path: 'memory.md', content: 'context', updatedAt: '2026-05-08T20:00:00Z' },
    ])).toEqual(expect.objectContaining({
      isActive: true,
      fileCount: 2,
      browserPageCount: 1,
      previewItems: ['Docs'],
    }));
  });

  it('handles empty roots and legacy projects without optional metadata', () => {
    const emptyRoot: TreeNode = { id: 'root', name: 'Root', type: 'root' };
    const legacyWorkspace: TreeNode = { id: 'ws-legacy', name: 'Legacy', type: 'workspace' };

    expect(listProjectSummaries(emptyRoot, 'missing', {})).toEqual([]);
    expect(nextProjectName(emptyRoot)).toBe('Project 1');
    expect(nextProjectColor(emptyRoot)).toBe('#60a5fa');
    expect(summarizeProject(legacyWorkspace, 'missing', [])).toEqual(expect.objectContaining({
      color: '#60a5fa',
      sessionCount: 0,
      browserPageCount: 0,
      fileCount: 0,
      memoryMB: 0,
      previewItems: [],
    }));
  });
});
