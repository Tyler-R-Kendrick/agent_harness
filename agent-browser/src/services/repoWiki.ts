import type { TreeNode, WorkspaceFile } from '../types';

export interface RepoWikiSourceCoverage {
  workspaceFileCount: number;
  browserPageCount: number;
  sessionCount: number;
  pluginCount: number;
  hookCount: number;
  memoryFileCount: number;
  settingsFileCount: number;
}

export interface RepoWikiSection {
  id: 'workspace-map' | 'capability-files' | 'runtime-surfaces';
  title: string;
  summary: string;
  sourcePaths: string[];
  facts: string[];
}

export interface RepoWikiDiagramEdge {
  from: string;
  to: string;
  label: string;
}

export interface RepoWikiDiagram {
  id: string;
  title: string;
  nodes: string[];
  edges: RepoWikiDiagramEdge[];
}

export interface RepoWikiOnboardingStep {
  title: string;
  detail: string;
  citationId: string;
}

export interface RepoWikiCitation {
  id: string;
  label: string;
  sourcePaths: string[];
  snippet: string;
}

export interface RepoWikiSnapshot {
  id: string;
  workspaceId: string;
  workspaceName: string;
  refreshedAt: string;
  summary: string;
  sourceCoverage: RepoWikiSourceCoverage;
  sections: RepoWikiSection[];
  diagrams: RepoWikiDiagram[];
  onboarding: RepoWikiOnboardingStep[];
  citations: RepoWikiCitation[];
}

export interface BuildRepoWikiSnapshotInput {
  workspace: TreeNode;
  files: WorkspaceFile[];
  refreshedAt?: string;
  artifactTitles?: string[];
}

function nowIso() {
  return new Date().toISOString();
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function collectTabs(node: TreeNode, kind: TreeNode['nodeKind']): TreeNode[] {
  const own = node.type === 'tab' && node.nodeKind === kind ? [node] : [];
  return [...own, ...(node.children ?? []).flatMap((child) => collectTabs(child, kind))];
}

function categoryFilePaths(files: WorkspaceFile[], predicate: (path: string) => boolean): string[] {
  return sortedUnique(files.map((file) => file.path).filter(predicate));
}

function isPluginPath(path: string): boolean {
  return path.includes('/plugins/') || path.includes('\\plugins\\') || path.endsWith('agent-harness.plugin.json');
}

function isHookPath(path: string): boolean {
  return path.includes('/hooks/') || path.includes('\\hooks\\');
}

function isMemoryPath(path: string): boolean {
  return path.startsWith('.memory/') || path.includes('.memory.');
}

function isSettingsPath(path: string): boolean {
  return path.endsWith('settings.json') || path.includes('/settings/') || path.includes('\\settings\\');
}

function buildCitation(workspaceId: string, section: RepoWikiSection): RepoWikiCitation {
  return {
    id: `wiki:${workspaceId}:${section.id}`,
    label: section.title,
    sourcePaths: section.sourcePaths,
    snippet: `${section.title}: ${section.summary}`,
  };
}

export function buildRepoWikiSnapshot({
  workspace,
  files,
  refreshedAt = nowIso(),
  artifactTitles = [],
}: BuildRepoWikiSnapshotInput): RepoWikiSnapshot {
  const browserPages = collectTabs(workspace, 'browser');
  const sessions = collectTabs(workspace, 'session');
  const filePaths = sortedUnique(files.map((file) => file.path));
  const pluginPaths = categoryFilePaths(files, isPluginPath);
  const hookPaths = categoryFilePaths(files, isHookPath);
  const memoryPaths = categoryFilePaths(files, isMemoryPath);
  const settingsPaths = categoryFilePaths(files, isSettingsPath);
  const capabilityPaths = sortedUnique([...pluginPaths, ...hookPaths, ...memoryPaths, ...settingsPaths]);

  const sourceCoverage: RepoWikiSourceCoverage = {
    workspaceFileCount: files.length,
    browserPageCount: browserPages.length,
    sessionCount: sessions.length,
    pluginCount: pluginPaths.length,
    hookCount: hookPaths.length,
    memoryFileCount: memoryPaths.length,
    settingsFileCount: settingsPaths.length,
  };

  const sections: RepoWikiSection[] = [
    {
      id: 'workspace-map',
      title: 'Repo map',
      summary: `${workspace.name} has ${browserPages.length} browser page${browserPages.length === 1 ? '' : 's'} and ${sessions.length} session${sessions.length === 1 ? '' : 's'} available for orientation.`,
      sourcePaths: filePaths,
      facts: [
        `Workspace node: ${workspace.name}`,
        `Browser pages: ${browserPages.map((page) => page.name).join(', ') || 'none'}`,
        `Sessions: ${sessions.map((session) => session.name).join(', ') || 'none'}`,
      ],
    },
    {
      id: 'capability-files',
      title: 'Capability files',
      summary: `${capabilityPaths.length} capability file${capabilityPaths.length === 1 ? '' : 's'} ground reusable tools, hooks, memory, and settings.`,
      sourcePaths: capabilityPaths,
      facts: [
        `Plugins: ${pluginPaths.length}`,
        `Hooks: ${hookPaths.length}`,
        `Memory files: ${memoryPaths.length}`,
        `Settings files: ${settingsPaths.length}`,
      ],
    },
    {
      id: 'runtime-surfaces',
      title: 'Runtime surfaces',
      summary: `${sessions.length} chat runtime${sessions.length === 1 ? '' : 's'}, ${browserPages.length} browser surface${browserPages.length === 1 ? '' : 's'}, and ${artifactTitles.length} artifact${artifactTitles.length === 1 ? '' : 's'} can cite this wiki.`,
      sourcePaths: sortedUnique([
        ...browserPages.map((page) => page.url ?? page.name),
        ...sessions.map((session) => session.name),
        ...artifactTitles,
      ]),
      facts: [
        'Agent prompt context can cite wiki sections by stable ID.',
        'Refreshes update the durable snapshot without backend filesystem access.',
      ],
    },
  ];

  const diagrams: RepoWikiDiagram[] = [
    {
      id: 'workspace-runtime',
      title: 'Workspace runtime architecture',
      nodes: [
        'Workspace files',
        'Repo wiki snapshot',
        'Agent prompt context',
        'Browser and session panels',
        'Review artifacts',
      ],
      edges: [
        { from: 'Workspace files', to: 'Repo wiki snapshot', label: 'ground' },
        { from: 'Repo wiki snapshot', to: 'Agent prompt context', label: 'summarizes' },
        { from: 'Workspace files', to: 'Agent prompt context', label: 'continue to load directly' },
        { from: 'Browser and session panels', to: 'Repo wiki snapshot', label: 'provide runtime surfaces' },
        { from: 'Repo wiki snapshot', to: 'Review artifacts', label: 'provides citations' },
      ],
    },
  ];

  const citations = sections.map((section) => buildCitation(workspace.id, section));
  const onboarding: RepoWikiOnboardingStep[] = [
    {
      title: 'Start with the repo map',
      detail: 'Use the workspace-map citation to orient on active pages, sessions, and stored files.',
      citationId: citations[0]?.id ?? `wiki:${workspace.id}:workspace-map`,
    },
    {
      title: 'Check capability files',
      detail: 'Use the capability-files citation before changing tools, hooks, memory, or settings.',
      citationId: citations[1]?.id ?? `wiki:${workspace.id}:capability-files`,
    },
    {
      title: 'Carry citations into review',
      detail: 'Use the runtime-surfaces citation when tying browser evidence and artifacts back to implementation work.',
      citationId: citations[2]?.id ?? `wiki:${workspace.id}:runtime-surfaces`,
    },
  ];

  return {
    id: `wiki:${workspace.id}`,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    refreshedAt,
    summary: `${workspace.name} wiki covers ${files.length} stored files, ${browserPages.length} browser pages, and ${sessions.length} sessions.`,
    sourceCoverage,
    sections,
    diagrams,
    onboarding,
    citations,
  };
}

export function buildRepoWikiPromptContext(snapshot: RepoWikiSnapshot | null | undefined): string {
  if (!snapshot) return '';
  return [
    `Repository wiki: ${snapshot.workspaceName}`,
    snapshot.summary,
    `Source coverage: ${snapshot.sourceCoverage.workspaceFileCount} files, ${snapshot.sourceCoverage.browserPageCount} browser pages, ${snapshot.sourceCoverage.sessionCount} sessions`,
    `Sections: ${snapshot.sections.map((section) => section.title).join(', ')}`,
    `Architecture views: ${snapshot.diagrams.map((diagram) => diagram.title).join(', ')}`,
    `Citations: ${snapshot.citations.map((citation) => citation.id).join(', ')}`,
  ].join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isRepoWikiSourceCoverage(value: unknown): value is RepoWikiSourceCoverage {
  if (!isRecord(value)) return false;
  return [
    'workspaceFileCount',
    'browserPageCount',
    'sessionCount',
    'pluginCount',
    'hookCount',
    'memoryFileCount',
    'settingsFileCount',
  ].every((key) => Number.isInteger(value[key]) && Number(value[key]) >= 0);
}

function isRepoWikiSection(value: unknown): value is RepoWikiSection {
  return isRecord(value)
    && ['workspace-map', 'capability-files', 'runtime-surfaces'].includes(String(value.id))
    && typeof value.title === 'string'
    && typeof value.summary === 'string'
    && isStringArray(value.sourcePaths)
    && isStringArray(value.facts);
}

function isRepoWikiDiagram(value: unknown): value is RepoWikiDiagram {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && isStringArray(value.nodes)
    && Array.isArray(value.edges)
    && value.edges.every((edge) => (
      isRecord(edge)
      && typeof edge.from === 'string'
      && typeof edge.to === 'string'
      && typeof edge.label === 'string'
    ));
}

function isRepoWikiOnboardingStep(value: unknown): value is RepoWikiOnboardingStep {
  return isRecord(value)
    && typeof value.title === 'string'
    && typeof value.detail === 'string'
    && typeof value.citationId === 'string';
}

function isRepoWikiCitation(value: unknown): value is RepoWikiCitation {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && isStringArray(value.sourcePaths)
    && typeof value.snippet === 'string';
}

export function isRepoWikiSnapshot(value: unknown): value is RepoWikiSnapshot {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.workspaceName === 'string'
    && typeof value.refreshedAt === 'string'
    && typeof value.summary === 'string'
    && isRepoWikiSourceCoverage(value.sourceCoverage)
    && Array.isArray(value.sections)
    && value.sections.every(isRepoWikiSection)
    && Array.isArray(value.diagrams)
    && value.diagrams.every(isRepoWikiDiagram)
    && Array.isArray(value.onboarding)
    && value.onboarding.every(isRepoWikiOnboardingStep)
    && Array.isArray(value.citations)
    && value.citations.every(isRepoWikiCitation);
}

export function isRepoWikiSnapshotsByWorkspace(value: unknown): value is Record<string, RepoWikiSnapshot> {
  return isRecord(value) && Object.values(value).every(isRepoWikiSnapshot);
}
