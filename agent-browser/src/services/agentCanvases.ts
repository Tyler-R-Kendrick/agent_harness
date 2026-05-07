import {
  ARTIFACTS_DRIVE_NAME,
  createArtifact,
  updateArtifactFiles,
  type AgentArtifact,
  type ArtifactFile,
  type CreateArtifactOptions,
  type UpdateArtifactOptions,
} from './artifacts';

export const AGENT_CANVAS_KIND_PREFIX = 'agent-canvas:';

export type AgentCanvasKind = 'dashboard' | 'diagram' | 'checklist' | 'review-panel';

export interface AgentCanvasSummary {
  id: string;
  title: string;
  description?: string;
  canvasKind: AgentCanvasKind;
  revision: number;
  updatedAt: string;
  fileCount: number;
  primaryFilePath: string;
  sourceSessionId?: string;
}

export interface CreateAgentCanvasInput {
  id?: string;
  title: string;
  description?: string;
  canvasKind: AgentCanvasKind;
  sourceSessionId?: string;
  references?: readonly string[];
  files: readonly ArtifactFile[];
}

export interface UpdateAgentCanvasPatch {
  expectedRevision: number;
  title?: string;
  description?: string;
  references?: readonly string[];
  files: readonly ArtifactFile[];
}

export interface CreateStarterAgentCanvasesInput {
  workspaceId: string;
  workspaceName: string;
  sourceSessionId?: string;
  now?: () => string;
}

const CANVAS_KIND_LABELS: Record<AgentCanvasKind, string> = {
  dashboard: 'Dashboard',
  diagram: 'Diagram',
  checklist: 'Checklist',
  'review-panel': 'Review panel',
};

const CANVAS_KIND_ORDER: AgentCanvasKind[] = ['dashboard', 'diagram', 'checklist', 'review-panel'];

export function createAgentCanvasArtifact(
  input: CreateAgentCanvasInput,
  options: CreateArtifactOptions = {},
): AgentArtifact {
  return createArtifact({
    id: input.id,
    title: input.title,
    description: input.description,
    kind: toAgentCanvasArtifactKind(input.canvasKind),
    sourceSessionId: input.sourceSessionId,
    references: input.references,
    files: input.files,
  }, options);
}

export function updateAgentCanvasArtifactSafely(
  artifact: AgentArtifact,
  patch: UpdateAgentCanvasPatch,
  options: UpdateArtifactOptions = {},
): AgentArtifact {
  if (!isAgentCanvasArtifact(artifact)) {
    throw new TypeError('Agent canvas updates require an agent-canvas artifact.');
  }
  const currentRevision = getAgentCanvasRevision(artifact);
  if (patch.expectedRevision !== currentRevision) {
    throw new Error(`Canvas revision mismatch for ${artifact.id}: expected ${patch.expectedRevision}, current ${currentRevision}.`);
  }
  return updateArtifactFiles(artifact, {
    title: patch.title,
    description: patch.description,
    kind: artifact.kind,
    references: patch.references,
    files: patch.files,
  }, options);
}

export function listAgentCanvasSummaries(artifacts: readonly AgentArtifact[]): AgentCanvasSummary[] {
  return artifacts
    .filter(isAgentCanvasArtifact)
    .map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      ...(artifact.description ? { description: artifact.description } : {}),
      canvasKind: parseAgentCanvasKind(artifact.kind),
      revision: getAgentCanvasRevision(artifact),
      updatedAt: artifact.updatedAt,
      fileCount: artifact.files.length,
      primaryFilePath: artifact.files[0]?.path ?? 'canvas.md',
      ...(artifact.sourceSessionId ? { sourceSessionId: artifact.sourceSessionId } : {}),
    }))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.title.localeCompare(right.title));
}

export function buildAgentCanvasPromptContext(artifacts: readonly AgentArtifact[]): string {
  const summaries = listAgentCanvasSummaries(artifacts);
  if (!summaries.length) return '';
  const lines = [
    'Durable agent canvases are mounted as artifacts. Use explicit canvas ids, file paths, and the current expected revision for safe follow-up updates.',
  ];

  for (const summary of summaries) {
    const artifact = artifacts.find((candidate) => candidate.id === summary.id);
    lines.push('');
    lines.push(`Canvas: ${summary.title} (${summary.id})`);
    lines.push(`Kind: ${summary.canvasKind}`);
    lines.push(`Revision: ${summary.revision}`);
    lines.push(`Updated: ${summary.updatedAt}`);
    if (summary.description) lines.push(`Description: ${summary.description}`);
    for (const file of artifact?.files ?? []) {
      lines.push(`File: ${ARTIFACTS_DRIVE_NAME}/${summary.id}/${file.path}`);
    }
  }

  return lines.join('\n');
}

export function createStarterAgentCanvases({
  workspaceId,
  workspaceName,
  sourceSessionId,
  now,
}: CreateStarterAgentCanvasesInput): AgentArtifact[] {
  const safeWorkspaceId = workspaceId.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace';
  return CANVAS_KIND_ORDER.map((canvasKind) => createAgentCanvasArtifact({
    id: `canvas-${safeWorkspaceId}-${canvasKind}`,
    title: `${workspaceName} ${CANVAS_KIND_LABELS[canvasKind].toLowerCase()}`,
    description: starterDescription(canvasKind, workspaceName),
    canvasKind,
    sourceSessionId,
    files: [starterCanvasFile(canvasKind, workspaceName)],
  }, { now }));
}

export function getAgentCanvasRevision(artifact: AgentArtifact): number {
  return artifact.versions.length + 1;
}

export function isAgentCanvasArtifact(artifact: AgentArtifact): boolean {
  return parseOptionalAgentCanvasKind(artifact.kind) !== null;
}

export function parseAgentCanvasKind(kind: string | undefined): AgentCanvasKind {
  const parsed = parseOptionalAgentCanvasKind(kind);
  if (!parsed) throw new TypeError(`Unknown agent canvas kind: ${kind ?? 'none'}`);
  return parsed;
}

function toAgentCanvasArtifactKind(kind: AgentCanvasKind): string {
  return `${AGENT_CANVAS_KIND_PREFIX}${kind}`;
}

function parseOptionalAgentCanvasKind(kind: string | undefined): AgentCanvasKind | null {
  if (!kind?.startsWith(AGENT_CANVAS_KIND_PREFIX)) return null;
  const rawKind = kind.slice(AGENT_CANVAS_KIND_PREFIX.length);
  return (CANVAS_KIND_ORDER as readonly string[]).includes(rawKind)
    ? rawKind as AgentCanvasKind
    : null;
}

function starterDescription(kind: AgentCanvasKind, workspaceName: string): string {
  if (kind === 'dashboard') return `Persistent dashboard for ${workspaceName} run health, evidence, and next actions.`;
  if (kind === 'diagram') return `Durable diagram for ${workspaceName} architecture and control flow.`;
  if (kind === 'checklist') return `Follow-up checklist for ${workspaceName} execution and review.`;
  return `Review panel for ${workspaceName} decisions, risks, and validation evidence.`;
}

function starterCanvasFile(kind: AgentCanvasKind, workspaceName: string): ArtifactFile {
  if (kind === 'dashboard') {
    return {
      path: 'dashboard.md',
      mediaType: 'text/markdown',
      content: `# ${workspaceName} Dashboard\n\n- Status: ready\n- Evidence: pending\n- Next action: start the agent run\n`,
    };
  }
  if (kind === 'diagram') {
    return {
      path: 'diagram.md',
      mediaType: 'text/markdown',
      content: `# ${workspaceName} Diagram\n\n\`\`\`mermaid\ngraph TD\n  Chat[Chat turn] --> Canvas[Durable canvas]\n  Canvas --> Review[Review panel]\n\`\`\`\n`,
    };
  }
  if (kind === 'checklist') {
    return {
      path: 'checklist.md',
      mediaType: 'text/markdown',
      content: `# ${workspaceName} Checklist\n\n- [ ] Capture task intent\n- [ ] Update canvas with evidence\n- [ ] Review revision before follow-up\n`,
    };
  }
  return {
    path: 'review-panel.md',
    mediaType: 'text/markdown',
    content: `# ${workspaceName} Review Panel\n\n## Decisions\n\n- Durable canvases use artifact IDs and revision checks.\n\n## Risks\n\n- Follow-up updates must include the current expected revision.\n`,
  };
}
