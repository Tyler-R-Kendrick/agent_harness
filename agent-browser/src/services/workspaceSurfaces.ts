import { ARTIFACTS_DRIVE_NAME, type AgentArtifact } from './artifacts';

export type WorkspaceSurfaceType = 'dashboard' | 'widget' | 'guided-flow' | 'browser-pane' | 'review-panel';
export type WorkspaceSurfaceRenderTarget = 'dashboard' | 'panel' | 'browser';
export type WorkspaceSurfaceStatus = 'active' | 'rolled-back';

export interface WorkspaceSurfacePermissions {
  canRead: boolean;
  canEdit: boolean;
  canRollback: boolean;
  canShare: boolean;
}

export interface WorkspaceSurfaceSnapshot {
  id: string;
  revision: number;
  title: string;
  description?: string;
  surfaceType: WorkspaceSurfaceType;
  renderTarget: WorkspaceSurfaceRenderTarget;
  artifactId: string;
  artifactFilePath: string;
  permissions: WorkspaceSurfacePermissions;
  status: WorkspaceSurfaceStatus;
  createdAt: string;
}

export interface WorkspaceSurface extends WorkspaceSurfaceSnapshot {
  workspaceId: string;
  createdByAgent: string;
  ownerSessionId?: string;
  updatedAt: string;
  versions: WorkspaceSurfaceSnapshot[];
}

export interface WorkspaceSurfaceSummary {
  id: string;
  title: string;
  description?: string;
  surfaceType: WorkspaceSurfaceType;
  renderTarget: WorkspaceSurfaceRenderTarget;
  artifactId: string;
  artifactFilePath: string;
  createdByAgent: string;
  ownerSessionId?: string;
  revision: number;
  permissionSummary: string;
  canRollback: boolean;
  updatedAt: string;
}

export interface CreateWorkspaceSurfaceInput {
  workspaceId: string;
  artifact: AgentArtifact;
  artifactFilePath?: string;
  surfaceType: WorkspaceSurfaceType;
  renderTarget?: WorkspaceSurfaceRenderTarget;
  title?: string;
  description?: string;
  createdByAgent: string;
  ownerSessionId?: string;
  permissions?: Partial<WorkspaceSurfacePermissions>;
}

export interface UpdateWorkspaceSurfacePatch {
  expectedRevision: number;
  title?: string;
  description?: string;
  surfaceType?: WorkspaceSurfaceType;
  renderTarget?: WorkspaceSurfaceRenderTarget;
  artifactId?: string;
  artifactFilePath?: string;
  permissions?: Partial<WorkspaceSurfacePermissions>;
  status?: WorkspaceSurfaceStatus;
}

export interface WorkspaceSurfaceOptions {
  now?: () => string;
}

export const DEFAULT_WORKSPACE_SURFACE_PERMISSIONS: WorkspaceSurfacePermissions = Object.freeze({
  canRead: true,
  canEdit: true,
  canRollback: true,
  canShare: false,
});

const SURFACE_TYPES = new Set<WorkspaceSurfaceType>(['dashboard', 'widget', 'guided-flow', 'browser-pane', 'review-panel']);
const RENDER_TARGETS = new Set<WorkspaceSurfaceRenderTarget>(['dashboard', 'panel', 'browser']);
const STATUSES = new Set<WorkspaceSurfaceStatus>(['active', 'rolled-back']);

export function createWorkspaceSurface(
  input: CreateWorkspaceSurfaceInput,
  options: WorkspaceSurfaceOptions = {},
): WorkspaceSurface {
  const timestamp = options.now?.() ?? new Date().toISOString();
  const artifactFilePath = normalizeArtifactFilePath(input.artifactFilePath ?? input.artifact.files[0]?.path ?? '');
  const workspaceId = normalizeRequiredText(input.workspaceId, 'Workspace id is required.');
  const artifactId = normalizeRequiredText(input.artifact.id, 'Artifact id is required.');
  return {
    id: `surface-${slugify(workspaceId)}-${slugify(artifactId)}-${slugify(artifactFilePath)}`,
    workspaceId,
    artifactId,
    artifactFilePath,
    surfaceType: input.surfaceType,
    renderTarget: input.renderTarget ?? defaultRenderTarget(input.surfaceType),
    title: normalizeOptionalText(input.title) ?? input.artifact.title,
    ...(input.description ? { description: input.description } : input.artifact.description ? { description: input.artifact.description } : {}),
    createdByAgent: normalizeRequiredText(input.createdByAgent, 'Created-by agent is required.'),
    ...(input.ownerSessionId ? { ownerSessionId: input.ownerSessionId } : {}),
    permissions: normalizePermissions(input.permissions),
    revision: 1,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
    versions: [],
  };
}

export function updateWorkspaceSurface(
  surface: WorkspaceSurface,
  patch: UpdateWorkspaceSurfacePatch,
  options: WorkspaceSurfaceOptions = {},
): WorkspaceSurface {
  if (patch.expectedRevision !== surface.revision) {
    throw new Error(`Workspace surface revision mismatch for ${surface.id}: expected ${patch.expectedRevision}, current ${surface.revision}.`);
  }
  const timestamp = options.now?.() ?? new Date().toISOString();
  const nextRevision = surface.revision + 1;
  return {
    ...surface,
    title: normalizeOptionalText(patch.title) ?? surface.title,
    description: patch.description ?? surface.description,
    surfaceType: patch.surfaceType ?? surface.surfaceType,
    renderTarget: patch.renderTarget ?? surface.renderTarget,
    artifactId: patch.artifactId ? normalizeRequiredText(patch.artifactId, 'Artifact id is required.') : surface.artifactId,
    artifactFilePath: patch.artifactFilePath ? normalizeArtifactFilePath(patch.artifactFilePath) : surface.artifactFilePath,
    permissions: patch.permissions ? normalizePermissions(patch.permissions, surface.permissions) : { ...surface.permissions },
    status: patch.status ?? surface.status,
    revision: nextRevision,
    updatedAt: timestamp,
    versions: [
      createSurfaceSnapshot(surface),
      ...surface.versions.map(cloneSurfaceSnapshot),
    ],
  };
}

export function rollbackWorkspaceSurface(
  surface: WorkspaceSurface,
  versionId: string,
  options: WorkspaceSurfaceOptions = {},
): WorkspaceSurface {
  if (!surface.permissions.canRollback) {
    throw new Error(`Workspace surface ${surface.id} does not grant rollback permission.`);
  }
  const snapshot = surface.versions.find((version) => version.id === versionId);
  if (!snapshot) {
    throw new Error(`Unknown workspace surface version: ${versionId}.`);
  }
  const timestamp = options.now?.() ?? new Date().toISOString();
  return {
    ...surface,
    title: snapshot.title,
    description: snapshot.description,
    surfaceType: snapshot.surfaceType,
    renderTarget: snapshot.renderTarget,
    artifactId: snapshot.artifactId,
    artifactFilePath: snapshot.artifactFilePath,
    permissions: { ...snapshot.permissions },
    status: 'active',
    revision: surface.revision + 1,
    updatedAt: timestamp,
    versions: [
      createSurfaceSnapshot(surface),
      ...surface.versions.map(cloneSurfaceSnapshot),
    ],
  };
}

export function listWorkspaceSurfaceSummaries(surfaces: readonly WorkspaceSurface[]): WorkspaceSurfaceSummary[] {
  return surfaces
    .filter((surface) => surface.status === 'active')
    .map((surface) => ({
      id: surface.id,
      title: surface.title,
      ...(surface.description ? { description: surface.description } : {}),
      surfaceType: surface.surfaceType,
      renderTarget: surface.renderTarget,
      artifactId: surface.artifactId,
      artifactFilePath: surface.artifactFilePath,
      createdByAgent: surface.createdByAgent,
      ...(surface.ownerSessionId ? { ownerSessionId: surface.ownerSessionId } : {}),
      revision: surface.revision,
      permissionSummary: formatWorkspaceSurfacePermissions(surface.permissions),
      canRollback: surface.permissions.canRollback && surface.versions.length > 0,
      updatedAt: surface.updatedAt,
    }))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.title.localeCompare(right.title));
}

export function buildWorkspaceSurfacePromptContext(surfaces: readonly WorkspaceSurface[]): string {
  const activeSurfaces = listWorkspaceSurfaceSummaries(surfaces);
  if (!activeSurfaces.length) return '';
  const lines = ['Persistent workspace surfaces are governed app outputs linked to artifacts.'];
  for (const surface of activeSurfaces) {
    lines.push('');
    lines.push(`Surface: ${surface.title} (${surface.id})`);
    lines.push(`Type: ${surface.surfaceType}`);
    lines.push(`Render target: ${surface.renderTarget}`);
    lines.push(`Artifact: ${ARTIFACTS_DRIVE_NAME}/${surface.artifactId}/${surface.artifactFilePath}`);
    lines.push(`Owner: ${surface.createdByAgent}${surface.ownerSessionId ? ` / ${surface.ownerSessionId}` : ''}`);
    lines.push(`Revision: ${surface.revision}`);
    lines.push(`Permissions: ${surface.permissionSummary}`);
    lines.push('Instruction: update a surface only with its current expected revision; use rollback only when canRollback is granted.');
  }
  return lines.join('\n');
}

export function formatWorkspaceSurfacePermissions(permissions: WorkspaceSurfacePermissions): string {
  const labels = [
    permissions.canRead ? 'read' : '',
    permissions.canEdit ? 'edit' : '',
    permissions.canRollback ? 'rollback' : '',
    permissions.canShare ? 'share' : '',
  ].filter(Boolean);
  return labels.length ? labels.join(', ') : 'none';
}

export function isWorkspaceSurfacesByWorkspace(value: unknown): value is Record<string, WorkspaceSurface[]> {
  return isRecord(value) && Object.values(value).every((entry) => Array.isArray(entry) && entry.every(isWorkspaceSurface));
}

export function isWorkspaceSurface(value: unknown): value is WorkspaceSurface {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.workspaceId === 'string'
    && typeof value.artifactId === 'string'
    && typeof value.artifactFilePath === 'string'
    && isSafeArtifactFilePath(value.artifactFilePath)
    && typeof value.surfaceType === 'string'
    && SURFACE_TYPES.has(value.surfaceType as WorkspaceSurfaceType)
    && typeof value.renderTarget === 'string'
    && RENDER_TARGETS.has(value.renderTarget as WorkspaceSurfaceRenderTarget)
    && typeof value.title === 'string'
    && optionalString(value.description)
    && typeof value.createdByAgent === 'string'
    && optionalString(value.ownerSessionId)
    && isWorkspaceSurfacePermissions(value.permissions)
    && typeof value.revision === 'number'
    && Number.isInteger(value.revision)
    && value.revision >= 1
    && typeof value.status === 'string'
    && STATUSES.has(value.status as WorkspaceSurfaceStatus)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && Array.isArray(value.versions)
    && value.versions.every(isWorkspaceSurfaceSnapshot)
  );
}

function createSurfaceSnapshot(surface: WorkspaceSurface): WorkspaceSurfaceSnapshot {
  return {
    id: `${surface.id}-revision-${surface.revision}`,
    revision: surface.revision,
    title: surface.title,
    ...(surface.description ? { description: surface.description } : {}),
    surfaceType: surface.surfaceType,
    renderTarget: surface.renderTarget,
    artifactId: surface.artifactId,
    artifactFilePath: surface.artifactFilePath,
    permissions: { ...surface.permissions },
    status: surface.status,
    createdAt: surface.updatedAt,
  };
}

function cloneSurfaceSnapshot(snapshot: WorkspaceSurfaceSnapshot): WorkspaceSurfaceSnapshot {
  return {
    ...snapshot,
    permissions: { ...snapshot.permissions },
  };
}

function isWorkspaceSurfaceSnapshot(value: unknown): value is WorkspaceSurfaceSnapshot {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.revision === 'number'
    && Number.isInteger(value.revision)
    && value.revision >= 1
    && typeof value.title === 'string'
    && optionalString(value.description)
    && typeof value.surfaceType === 'string'
    && SURFACE_TYPES.has(value.surfaceType as WorkspaceSurfaceType)
    && typeof value.renderTarget === 'string'
    && RENDER_TARGETS.has(value.renderTarget as WorkspaceSurfaceRenderTarget)
    && typeof value.artifactId === 'string'
    && typeof value.artifactFilePath === 'string'
    && isSafeArtifactFilePath(value.artifactFilePath)
    && isWorkspaceSurfacePermissions(value.permissions)
    && typeof value.status === 'string'
    && STATUSES.has(value.status as WorkspaceSurfaceStatus)
    && typeof value.createdAt === 'string'
  );
}

function isWorkspaceSurfacePermissions(value: unknown): value is WorkspaceSurfacePermissions {
  if (!isRecord(value)) return false;
  return (
    typeof value.canRead === 'boolean'
    && typeof value.canEdit === 'boolean'
    && typeof value.canRollback === 'boolean'
    && typeof value.canShare === 'boolean'
  );
}

function normalizePermissions(
  permissions: Partial<WorkspaceSurfacePermissions> | undefined,
  fallback: WorkspaceSurfacePermissions = DEFAULT_WORKSPACE_SURFACE_PERMISSIONS,
): WorkspaceSurfacePermissions {
  return {
    canRead: permissions?.canRead ?? fallback.canRead,
    canEdit: permissions?.canEdit ?? fallback.canEdit,
    canRollback: permissions?.canRollback ?? fallback.canRollback,
    canShare: permissions?.canShare ?? fallback.canShare,
  };
}

function defaultRenderTarget(surfaceType: WorkspaceSurfaceType): WorkspaceSurfaceRenderTarget {
  if (surfaceType === 'browser-pane') return 'browser';
  if (surfaceType === 'guided-flow' || surfaceType === 'review-panel') return 'panel';
  return 'dashboard';
}

function normalizeArtifactFilePath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!isSafeArtifactFilePath(normalized)) {
    throw new Error('Workspace surface artifact file paths must be relative paths without parent traversal.');
  }
  return normalized;
}

function isSafeArtifactFilePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').trim();
  return (
    normalized.length > 0
    && !normalized.startsWith('/')
    && !normalized.startsWith('//')
    && !/^[a-zA-Z]:\//.test(normalized)
    && normalized.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')
  );
}

function normalizeRequiredText(value: string, message: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(message);
  return trimmed;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'surface';
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
