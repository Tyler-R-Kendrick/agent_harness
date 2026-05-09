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

export type RepoWikiKnowledgeNodeKind = 'note' | 'tag' | 'source' | 'runtime';
export type RepoWikiKnowledgeLinkKind = 'wikilink' | 'backlink' | 'provenance' | 'skos' | 'mention';

export interface RepoWikiKnowledgeProperty {
  key: string;
  value: string;
}

export interface RepoWikiKnowledgeNode {
  id: string;
  label: string;
  kind: RepoWikiKnowledgeNodeKind;
  tags: string[];
  properties: RepoWikiKnowledgeProperty[];
  inbound: number;
  outbound: number;
  localDepth: number;
  citationId?: string;
}

export interface RepoWikiKnowledgeLink {
  from: string;
  to: string;
  label: string;
  predicate: string;
  kind: RepoWikiKnowledgeLinkKind;
  directed: boolean;
  citationId?: string;
}

export interface RepoWikiKnowledgeGroup {
  id: string;
  label: string;
  color: string;
  query: string;
}

export interface RepoWikiUnlinkedMention {
  mention: string;
  sourcePath: string;
  targetId: string;
  confidence: number;
}

export interface RepoWikiCanvasCard {
  id: string;
  nodeId: string;
  kind: RepoWikiKnowledgeNodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RepoWikiCanvasLayout {
  format: 'json-canvas';
  cards: RepoWikiCanvasCard[];
}

export interface RepoWikiKnowledgeModel {
  standards: string[];
  graphModes: {
    globalNodeCount: number;
    localFocusId: string;
    localDepth: number;
  };
  nodes: RepoWikiKnowledgeNode[];
  links: RepoWikiKnowledgeLink[];
  groups: RepoWikiKnowledgeGroup[];
  unlinkedMentions: RepoWikiUnlinkedMention[];
  canvas: RepoWikiCanvasLayout;
}

export type RepoWikiMemoryArchitectureLayerId =
  | 'prompt-snapshot'
  | 'session-search'
  | 'graph-rag'
  | 'wiki-vault'
  | 'procedural-skills'
  | 'activation-tiers'
  | 'provider-adapters';

export interface RepoWikiMemoryArchitectureLayer {
  id: RepoWikiMemoryArchitectureLayerId;
  title: string;
  inspiration: string;
  harnessImplementation: string;
  storage: string;
  retrievalMode: string;
  capabilities: string[];
  sourcePaths: string[];
}

export interface RepoWikiMemoryArchitectureRoadmapItem {
  phase: 'Foundation' | 'Retrieval' | 'Learning loop' | 'Provider bridge';
  focus: string;
  outcome: string;
}

export interface RepoWikiMemoryArchitectureSynthesis {
  designGoal: string;
  recommendedStack: string[];
  layers: RepoWikiMemoryArchitectureLayer[];
  gaps: string[];
  roadmap: RepoWikiMemoryArchitectureRoadmapItem[];
  sourcePaths: string[];
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
  knowledgeModel: RepoWikiKnowledgeModel;
  memoryArchitecture: RepoWikiMemoryArchitectureSynthesis;
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

const KNOWLEDGE_MODEL_STANDARDS = [
  'Obsidian wikilinks/backlinks/properties',
  'RDF triples',
  'SKOS concept groups',
  'PROV provenance',
  'JSON Canvas layout',
];

const MEMORY_ARCHITECTURE_SOURCE_PATHS = [
  'reference_impl/features/workspace-model/decisions/ADR-002-four-tier-memory-model.md',
  'docs/superpowers/plans/2026-04-24-workspace-memory.md',
  'docs/superpowers/plans/2026-05-08-graph-knowledge.md',
  'docs/superpowers/plans/2026-05-08-persistent-memory-graphs.md',
  'harness-core/src/memory.ts',
  'agent-browser/src/services/workspaceMemory.ts',
  'agent-browser/src/services/graphKnowledge.ts',
  'agent-browser/src/services/persistentMemoryGraph.ts',
  'ext/harness/agent-skills/examples/default-workspace-skills/memory/SKILL.md',
];

function markdownLinkFor(title: string): string {
  return `[[${title}]]`;
}

function containsCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function buildUnlinkedMentions(
  files: WorkspaceFile[],
  sections: RepoWikiSection[],
  citations: RepoWikiCitation[],
): RepoWikiUnlinkedMention[] {
  const targetBySectionId = new Map(sections.map((section, index) => [section.id, citations[index]?.id ?? section.id]));
  const mentions: RepoWikiUnlinkedMention[] = [];
  for (const file of files) {
    for (const section of sections) {
      if (!containsCaseInsensitive(file.content, section.title)) continue;
      if (containsCaseInsensitive(file.content, markdownLinkFor(section.title))) continue;
      mentions.push({
        mention: section.title,
        sourcePath: file.path,
        targetId: targetBySectionId.get(section.id) ?? section.id,
        confidence: 0.82,
      });
    }
  }
  return mentions.sort((left, right) => (
    left.sourcePath.localeCompare(right.sourcePath)
    || left.mention.localeCompare(right.mention)
  ));
}

function withLinkCounts(nodes: RepoWikiKnowledgeNode[], links: RepoWikiKnowledgeLink[]): RepoWikiKnowledgeNode[] {
  return nodes.map((node) => ({
    ...node,
    inbound: links.filter((link) => link.to === node.id).length,
    outbound: links.filter((link) => link.from === node.id).length,
  }));
}

function buildKnowledgeModel({
  workspace,
  files,
  sections,
  citations,
  browserPages,
  sessions,
  artifactTitles,
}: {
  workspace: TreeNode;
  files: WorkspaceFile[];
  sections: RepoWikiSection[];
  citations: RepoWikiCitation[];
  browserPages: TreeNode[];
  sessions: TreeNode[];
  artifactTitles: string[];
}): RepoWikiKnowledgeModel {
  const [workspaceMapCitation, capabilityFilesCitation, runtimeSurfacesCitation] = citations;
  const workspaceMapId = workspaceMapCitation?.id ?? `wiki:${workspace.id}:workspace-map`;
  const capabilityFilesId = capabilityFilesCitation?.id ?? `wiki:${workspace.id}:capability-files`;
  const runtimeSurfacesId = runtimeSurfacesCitation?.id ?? `wiki:${workspace.id}:runtime-surfaces`;

  const nodeSeeds: RepoWikiKnowledgeNode[] = [
    {
      id: workspaceMapId,
      label: 'Repo map',
      kind: 'note',
      tags: ['orientation'],
      properties: [
        { key: 'path', value: 'Wiki/Repo map.md' },
        { key: 'aliases', value: `${workspace.name} map, workspace overview` },
        { key: 'sourceCount', value: String(sections[0]?.sourcePaths.length ?? 0) },
      ],
      inbound: 0,
      outbound: 0,
      localDepth: 0,
      citationId: workspaceMapId,
    },
    {
      id: capabilityFilesId,
      label: 'Capability files',
      kind: 'note',
      tags: ['capability'],
      properties: [
        { key: 'path', value: 'Wiki/Capability files.md' },
        { key: 'aliases', value: 'tools, hooks, memory, settings' },
        { key: 'sourceCount', value: String(sections[1]?.sourcePaths.length ?? 0) },
      ],
      inbound: 0,
      outbound: 0,
      localDepth: 1,
      citationId: capabilityFilesId,
    },
    {
      id: runtimeSurfacesId,
      label: 'Runtime surfaces',
      kind: 'runtime',
      tags: ['runtime'],
      properties: [
        { key: 'path', value: 'Wiki/Runtime surfaces.md' },
        { key: 'browserPages', value: String(browserPages.length) },
        { key: 'sessions', value: String(sessions.length) },
        { key: 'artifacts', value: String(artifactTitles.length) },
      ],
      inbound: 0,
      outbound: 0,
      localDepth: 2,
      citationId: runtimeSurfacesId,
    },
    {
      id: 'tag:orientation',
      label: '#orientation',
      kind: 'tag',
      tags: ['skos'],
      properties: [{ key: 'skos:prefLabel', value: 'Orientation' }],
      inbound: 0,
      outbound: 0,
      localDepth: 1,
    },
    {
      id: 'tag:capability',
      label: '#capability',
      kind: 'tag',
      tags: ['skos'],
      properties: [{ key: 'skos:prefLabel', value: 'Capability' }],
      inbound: 0,
      outbound: 0,
      localDepth: 2,
    },
    {
      id: 'tag:runtime',
      label: '#runtime',
      kind: 'tag',
      tags: ['skos'],
      properties: [{ key: 'skos:prefLabel', value: 'Runtime' }],
      inbound: 0,
      outbound: 0,
      localDepth: 2,
    },
    {
      id: 'source:workspace-files',
      label: 'Workspace files',
      kind: 'source',
      tags: ['provenance'],
      properties: [
        { key: 'prov:type', value: 'WorkspaceFileCollection' },
        { key: 'fileCount', value: String(files.length) },
      ],
      inbound: 0,
      outbound: 0,
      localDepth: 1,
    },
    {
      id: 'source:runtime-surfaces',
      label: 'Browser/session surfaces',
      kind: 'source',
      tags: ['provenance'],
      properties: [
        { key: 'prov:type', value: 'RuntimeSurfaceCollection' },
        { key: 'surfaceCount', value: String(browserPages.length + sessions.length) },
      ],
      inbound: 0,
      outbound: 0,
      localDepth: 2,
    },
  ];

  const links: RepoWikiKnowledgeLink[] = [
    {
      from: workspaceMapId,
      to: capabilityFilesId,
      label: 'links to',
      predicate: 'linksTo',
      kind: 'wikilink',
      directed: true,
      citationId: workspaceMapId,
    },
    {
      from: capabilityFilesId,
      to: runtimeSurfacesId,
      label: 'feeds',
      predicate: 'linksTo',
      kind: 'wikilink',
      directed: true,
      citationId: capabilityFilesId,
    },
    {
      from: runtimeSurfacesId,
      to: workspaceMapId,
      label: 'backlinks',
      predicate: 'backlinksTo',
      kind: 'backlink',
      directed: true,
      citationId: runtimeSurfacesId,
    },
    { from: workspaceMapId, to: 'tag:orientation', label: 'tagged', predicate: 'skos:related', kind: 'skos', directed: true },
    { from: capabilityFilesId, to: 'tag:capability', label: 'tagged', predicate: 'skos:related', kind: 'skos', directed: true },
    { from: runtimeSurfacesId, to: 'tag:runtime', label: 'tagged', predicate: 'skos:related', kind: 'skos', directed: true },
    { from: 'source:workspace-files', to: workspaceMapId, label: 'derives', predicate: 'prov:wasDerivedFrom', kind: 'provenance', directed: true, citationId: workspaceMapId },
    { from: 'source:workspace-files', to: capabilityFilesId, label: 'derives', predicate: 'prov:wasDerivedFrom', kind: 'provenance', directed: true, citationId: capabilityFilesId },
    { from: 'source:runtime-surfaces', to: runtimeSurfacesId, label: 'derives', predicate: 'prov:wasDerivedFrom', kind: 'provenance', directed: true, citationId: runtimeSurfacesId },
  ];

  const groups: RepoWikiKnowledgeGroup[] = [
    { id: 'orientation', label: 'Orientation', color: '#60a5fa', query: 'tag:#orientation OR path:Wiki/Repo map.md' },
    { id: 'capability', label: 'Capability', color: '#a78bfa', query: 'tag:#capability OR path:.agents' },
    { id: 'runtime', label: 'Runtime', color: '#34d399', query: 'tag:#runtime OR kind:runtime' },
    { id: 'provenance', label: 'Provenance', color: '#fbbf24', query: 'tag:#provenance OR predicate:prov:*' },
  ];

  const canvasCards: RepoWikiCanvasCard[] = nodeSeeds.map((node, index) => ({
    id: `card:${node.id}`,
    nodeId: node.id,
    kind: node.kind,
    x: 80 + (index % 4) * 220,
    y: 80 + Math.floor(index / 4) * 160,
    width: node.kind === 'note' ? 180 : 150,
    height: node.kind === 'note' ? 96 : 76,
  }));

  return {
    standards: KNOWLEDGE_MODEL_STANDARDS,
    graphModes: {
      globalNodeCount: nodeSeeds.length,
      localFocusId: workspaceMapId,
      localDepth: 2,
    },
    nodes: withLinkCounts(nodeSeeds, links),
    links,
    groups,
    unlinkedMentions: buildUnlinkedMentions(files, sections, citations),
    canvas: {
      format: 'json-canvas',
      cards: canvasCards,
    },
  };
}

function buildMemoryArchitectureSynthesis(): RepoWikiMemoryArchitectureSynthesis {
  const layers: RepoWikiMemoryArchitectureLayer[] = [
    {
      id: 'prompt-snapshot',
      title: 'Hermes-style prompt snapshot',
      inspiration: 'Hermes Agent MEMORY.md/USER.md',
      harnessImplementation: 'Bounded, curated .memory factoids injected into workspace prompt context with explicit scope and citations.',
      storage: '.memory/MEMORY.md plus user, project, workspace, and session memory markdown files',
      retrievalMode: 'always injected, bounded, curated',
      capabilities: [
        'preserve critical facts without retrieval latency',
        'show scope, source path, and line number in prompt context',
        'consolidate when the prompt snapshot approaches its budget',
      ],
      sourcePaths: [
        'docs/superpowers/plans/2026-04-24-workspace-memory.md',
        'agent-browser/src/services/workspaceMemory.ts',
        'ext/harness/agent-skills/examples/default-workspace-skills/memory/SKILL.md',
      ],
    },
    {
      id: 'session-search',
      title: 'Cross-session search',
      inspiration: 'Hermes session_search and full-text session recall',
      harnessImplementation: 'Search archived sessions, process logs, browser evidence, and task traces on demand instead of pushing every past turn into prompt memory.',
      storage: 'session history, chapters, process logs, browser evidence, and task traces',
      retrievalMode: 'on-demand full-text recall with summarizable evidence',
      capabilities: [
        'recover specific old conversations without bloating the system prompt',
        'cite session and process evidence when answering workspace questions',
        'keep automatic archives separate from agent-curated critical memory',
      ],
      sourcePaths: [
        'harness-core/src/memory.ts',
        'agent-browser/src/services/sessionChapters.ts',
        'agent-browser/src/services/processLog.ts',
      ],
    },
    {
      id: 'graph-rag',
      title: 'GraphRAG / PathRAG retrieval',
      inspiration: 'GraphRAG episodic, semantic, procedural, and temporal memory graphs',
      harnessImplementation: 'Use the existing deterministic graph services as the offline core for entity, claim, fact, path, community, temporal, and procedural recall.',
      storage: 'typed local graph with paths, claims, facts, events, communities, and hot memory blocks',
      retrievalMode: 'ranked lexical/entity/path retrieval with explainable context packs',
      capabilities: [
        'retrieve by entities, facts, paths, activation, communities, time, and skills',
        'explain why a memory was selected through path records and score breakdowns',
        'detect contradictions and preserve provenance before prompt injection',
      ],
      sourcePaths: [
        'docs/superpowers/plans/2026-05-08-graph-knowledge.md',
        'docs/superpowers/plans/2026-05-08-persistent-memory-graphs.md',
        'agent-browser/src/services/graphKnowledge.ts',
        'agent-browser/src/services/persistentMemoryGraph.ts',
      ],
    },
    {
      id: 'wiki-vault',
      title: 'Obsidian/DeepWiki vault',
      inspiration: 'Obsidian backlinks, graph view, unlinked mentions, and repository-grounded wiki pages',
      harnessImplementation: 'Render the repository wiki as a navigable knowledgebase with generated pages, backlinks, graph filters, source handles, and scoped chat.',
      storage: 'repo wiki pages, RDF-style links, SKOS groups, PROV sources, and JSON Canvas layout',
      retrievalMode: 'visual navigation plus scoped citation-aware chat',
      capabilities: [
        'let users navigate memory as pages, graph, sources, and questions',
        'surface unlinked mentions so latent concepts can become wiki links',
        'keep visual memory inspection separate from raw settings panels',
      ],
      sourcePaths: [
        'docs/superpowers/plans/2026-05-07-repository-grounded-wiki.md',
        'agent-browser/src/services/repoWiki.ts',
      ],
    },
    {
      id: 'procedural-skills',
      title: 'Procedural skill memory',
      inspiration: 'Hermes Skills System / agent-skills progressive disclosure',
      harnessImplementation: 'Treat repeatable workflows as skill bundles with concise triggers, references, scripts, templates, evals, and update paths.',
      storage: 'SKILL.md plus references, scripts, templates, assets, and eval fixtures',
      retrievalMode: 'progressive disclosure by skill name, trigger, or missing-tool fallback',
      capabilities: [
        'convert successful workflows and corrections into reusable skills',
        'load only the specific reference file or script needed for the current task',
        'preserve procedural memory outside chat transcript summaries',
      ],
      sourcePaths: [
        'skills/skill-creator/README.md',
        'ext/harness/agent-skills/examples/default-workspace-skills/create-agent-skill/SKILL.md',
        'ext/harness/agent-skills/examples/default-workspace-skills/memory/SKILL.md',
      ],
    },
    {
      id: 'activation-tiers',
      title: 'Hot/Warm/Cool/Cold activation',
      inspiration: 'Four-tier browser workspace memory model',
      harnessImplementation: 'Use hot prompt facts, warm retrieved graph context, cool serialized summaries, and cold source handles as a latency and token-budget policy.',
      storage: 'active prompt, cached graph context, serialized summary packs, and cold source handles',
      retrievalMode: 'promote or demote by recency, importance, confidence, and latency budget',
      capabilities: [
        'keep high-value memories instantly available while archiving low-value detail',
        'make retrieval cost visible as an activation tier rather than a hidden cache',
        'support graceful degradation when context, memory, or runtime budgets tighten',
      ],
      sourcePaths: [
        'reference_impl/features/workspace-model/decisions/ADR-002-four-tier-memory-model.md',
        'agent-browser/src/services/graphKnowledge.ts',
      ],
    },
    {
      id: 'provider-adapters',
      title: 'Provider adapters',
      inspiration: 'Hermes external memory providers and pluggable semantic stores',
      harnessImplementation: 'Add adapter contracts so external vector, graph, or profile stores augment the core local memory stack without becoming the source of truth.',
      storage: 'provider-specific semantic indexes, vector stores, user profiles, and remote knowledge graphs',
      retrievalMode: 'parallel provider recall merged with local provenance and confidence gates',
      capabilities: [
        'augment local memory with semantic search and cross-device user modeling',
        'keep local prompt snapshot and wiki citations authoritative',
        'allow provider-specific recall to be audited before promotion to durable memory',
      ],
      sourcePaths: [
        'harness-core/src/memory.ts',
        'lib/agent-browser-mcp/src/userContextTools.ts',
        'agent-browser/src/services/userContextMemory.ts',
      ],
    },
  ];

  return {
    designGoal: 'Aggregate competitor documentation and repo-local memory systems into one harness memory stack that is prompt-bounded, graph-retrievable, visually navigable, procedurally self-improving, tier-aware, and provider-extensible.',
    recommendedStack: [
      'Keep critical facts in bounded prompt snapshots.',
      'Use session search for archived conversation recall.',
      'Use GraphRAG / PathRAG for explainable semantic, episodic, temporal, and procedural recall.',
      'Expose repository knowledge through a wiki vault with backlinks and graph navigation.',
      'Promote reliable workflows into skills instead of burying procedures in summaries.',
      'Route memories through hot, warm, cool, and cold activation tiers.',
      'Let external providers augment local memory behind auditable adapters.',
    ],
    layers,
    gaps: [
      'Add a pluggable provider seam so external semantic stores augment, not replace, the core prompt snapshot.',
      'Add feedback-based episodic writes so successful traces become few-shot examples only after validation.',
      'Add budget-aware promotion rules that move memories between prompt, graph, summary, and cold citation tiers.',
      'Add a review queue for proposed procedural skill updates before agent-authored workflows become defaults.',
    ],
    roadmap: [
      {
        phase: 'Foundation',
        focus: 'Unify prompt snapshots, workspace memory files, and wiki citations.',
        outcome: 'Every recalled fact has scope, source, budget, and provenance.',
      },
      {
        phase: 'Retrieval',
        focus: 'Merge session search, graph paths, wiki backlinks, and provider candidates.',
        outcome: 'Answers can cite why a memory was retrieved and where it came from.',
      },
      {
        phase: 'Learning loop',
        focus: 'Promote validated episodes into semantic facts, graph paths, and procedural skills.',
        outcome: 'The harness improves from successful traces and user corrections without absorbing noise.',
      },
      {
        phase: 'Provider bridge',
        focus: 'Add auditable adapters for semantic stores, user models, and external knowledge graphs.',
        outcome: 'External memory expands recall while local provenance remains inspectable.',
      },
    ],
    sourcePaths: MEMORY_ARCHITECTURE_SOURCE_PATHS,
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
  const knowledgeModel = buildKnowledgeModel({
    workspace,
    files,
    sections,
    citations,
    browserPages,
    sessions,
    artifactTitles,
  });
  const memoryArchitecture = buildMemoryArchitectureSynthesis();

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
    knowledgeModel,
    memoryArchitecture,
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
    `Memory model: ${snapshot.knowledgeModel.standards.join(', ')}`,
    `Memory architectures: ${snapshot.memoryArchitecture.layers.map((layer) => layer.id).join(', ')}`,
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

function isRepoWikiKnowledgeProperty(value: unknown): value is RepoWikiKnowledgeProperty {
  return isRecord(value)
    && typeof value.key === 'string'
    && typeof value.value === 'string';
}

function isRepoWikiKnowledgeNode(value: unknown): value is RepoWikiKnowledgeNode {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && ['note', 'tag', 'source', 'runtime'].includes(String(value.kind))
    && isStringArray(value.tags)
    && Array.isArray(value.properties)
    && value.properties.every(isRepoWikiKnowledgeProperty)
    && Number.isInteger(value.inbound)
    && Number(value.inbound) >= 0
    && Number.isInteger(value.outbound)
    && Number(value.outbound) >= 0
    && Number.isInteger(value.localDepth)
    && Number(value.localDepth) >= 0
    && (value.citationId === undefined || typeof value.citationId === 'string');
}

function isRepoWikiKnowledgeLink(value: unknown): value is RepoWikiKnowledgeLink {
  return isRecord(value)
    && typeof value.from === 'string'
    && typeof value.to === 'string'
    && typeof value.label === 'string'
    && typeof value.predicate === 'string'
    && ['wikilink', 'backlink', 'provenance', 'skos', 'mention'].includes(String(value.kind))
    && typeof value.directed === 'boolean'
    && (value.citationId === undefined || typeof value.citationId === 'string');
}

function isRepoWikiKnowledgeGroup(value: unknown): value is RepoWikiKnowledgeGroup {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.color === 'string'
    && typeof value.query === 'string';
}

function isRepoWikiUnlinkedMention(value: unknown): value is RepoWikiUnlinkedMention {
  return isRecord(value)
    && typeof value.mention === 'string'
    && typeof value.sourcePath === 'string'
    && typeof value.targetId === 'string'
    && typeof value.confidence === 'number'
    && value.confidence >= 0
    && value.confidence <= 1;
}

function isRepoWikiCanvasCard(value: unknown): value is RepoWikiCanvasCard {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.nodeId === 'string'
    && ['note', 'tag', 'source', 'runtime'].includes(String(value.kind))
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && Number.isFinite(value.width)
    && Number(value.width) > 0
    && Number.isFinite(value.height)
    && Number(value.height) > 0;
}

function isRepoWikiKnowledgeModel(value: unknown): value is RepoWikiKnowledgeModel {
  return isRecord(value)
    && isStringArray(value.standards)
    && isRecord(value.graphModes)
    && Number.isInteger(value.graphModes.globalNodeCount)
    && typeof value.graphModes.localFocusId === 'string'
    && Number.isInteger(value.graphModes.localDepth)
    && Array.isArray(value.nodes)
    && value.nodes.every(isRepoWikiKnowledgeNode)
    && Array.isArray(value.links)
    && value.links.every(isRepoWikiKnowledgeLink)
    && Array.isArray(value.groups)
    && value.groups.every(isRepoWikiKnowledgeGroup)
    && Array.isArray(value.unlinkedMentions)
    && value.unlinkedMentions.every(isRepoWikiUnlinkedMention)
    && isRecord(value.canvas)
    && value.canvas.format === 'json-canvas'
    && Array.isArray(value.canvas.cards)
    && value.canvas.cards.every(isRepoWikiCanvasCard);
}

function isRepoWikiMemoryArchitectureLayer(value: unknown): value is RepoWikiMemoryArchitectureLayer {
  return isRecord(value)
    && [
      'prompt-snapshot',
      'session-search',
      'graph-rag',
      'wiki-vault',
      'procedural-skills',
      'activation-tiers',
      'provider-adapters',
    ].includes(String(value.id))
    && typeof value.title === 'string'
    && typeof value.inspiration === 'string'
    && typeof value.harnessImplementation === 'string'
    && typeof value.storage === 'string'
    && typeof value.retrievalMode === 'string'
    && isStringArray(value.capabilities)
    && isStringArray(value.sourcePaths);
}

function isRepoWikiMemoryArchitectureRoadmapItem(value: unknown): value is RepoWikiMemoryArchitectureRoadmapItem {
  return isRecord(value)
    && ['Foundation', 'Retrieval', 'Learning loop', 'Provider bridge'].includes(String(value.phase))
    && typeof value.focus === 'string'
    && typeof value.outcome === 'string';
}

function isRepoWikiMemoryArchitectureSynthesis(value: unknown): value is RepoWikiMemoryArchitectureSynthesis {
  return isRecord(value)
    && typeof value.designGoal === 'string'
    && isStringArray(value.recommendedStack)
    && Array.isArray(value.layers)
    && value.layers.every(isRepoWikiMemoryArchitectureLayer)
    && isStringArray(value.gaps)
    && Array.isArray(value.roadmap)
    && value.roadmap.every(isRepoWikiMemoryArchitectureRoadmapItem)
    && isStringArray(value.sourcePaths);
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
    && value.citations.every(isRepoWikiCitation)
    && isRepoWikiKnowledgeModel(value.knowledgeModel)
    && isRepoWikiMemoryArchitectureSynthesis(value.memoryArchitecture);
}

export function isRepoWikiSnapshotsByWorkspace(value: unknown): value is Record<string, RepoWikiSnapshot> {
  return isRecord(value) && Object.values(value).every(isRepoWikiSnapshot);
}
