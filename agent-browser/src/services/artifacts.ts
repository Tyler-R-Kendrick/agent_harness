export const ARTIFACTS_DRIVE_NAME = '//artifacts';

export interface ArtifactFile {
  path: string;
  content: string;
  mediaType?: string;
  updatedAt?: string;
}

export interface AgentArtifactVersion {
  id: string;
  createdAt: string;
  title: string;
  description?: string;
  kind?: string;
  files: ArtifactFile[];
  references: string[];
}

export interface AgentArtifact {
  id: string;
  title: string;
  description?: string;
  kind?: string;
  sourceSessionId?: string;
  createdAt: string;
  updatedAt: string;
  files: ArtifactFile[];
  references: string[];
  versions: AgentArtifactVersion[];
}

export interface ArtifactPanelSelection {
  artifactId: string;
  filePath?: string | null;
}

export interface ArtifactDownloadPayload {
  fileName: string;
  mediaType: string;
  data: string | Uint8Array;
  kind: 'file' | 'zip';
}

export interface CreateArtifactOptions {
  now?: () => string;
  idFactory?: () => string;
}

export interface UpdateArtifactOptions {
  now?: () => string;
  idFactory?: () => string;
}

type ArtifactInput = {
  id?: string;
  title?: string;
  description?: string;
  kind?: string;
  sourceSessionId?: string;
  references?: readonly string[];
  files: readonly ArtifactFile[];
};

const TEXT_ENCODER = new TextEncoder();
const ZIP_EPOCH = new Date('1980-01-01T00:00:00.000Z');

export function createArtifact(input: ArtifactInput, options: CreateArtifactOptions = {}): AgentArtifact {
  const timestamp = options.now?.() ?? new Date().toISOString();
  const id = normalizeArtifactId(input.id ?? options.idFactory?.() ?? `artifact-${timestamp.replace(/[^0-9]/g, '')}`);
  const files = normalizeArtifactFiles(input.files);
  return {
    id,
    title: normalizeOptionalText(input.title) ?? id,
    ...(input.description ? { description: input.description } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.sourceSessionId ? { sourceSessionId: input.sourceSessionId } : {}),
    createdAt: timestamp,
    updatedAt: timestamp,
    files,
    references: normalizeReferences(input.references ?? []),
    versions: [],
  };
}

export function createArtifactVersion(
  artifact: AgentArtifact,
  options: { id: string; createdAt: string },
): AgentArtifactVersion {
  return {
    id: options.id,
    createdAt: options.createdAt,
    title: artifact.title,
    ...(artifact.description ? { description: artifact.description } : {}),
    ...(artifact.kind ? { kind: artifact.kind } : {}),
    files: cloneArtifactFiles(artifact.files),
    references: [...artifact.references],
  };
}

export function updateArtifactFiles(
  artifact: AgentArtifact,
  patch: { files: readonly ArtifactFile[]; title?: string; description?: string; kind?: string; references?: readonly string[] },
  options: UpdateArtifactOptions = {},
): AgentArtifact {
  const timestamp = options.now?.() ?? new Date().toISOString();
  const versionId = options.idFactory?.() ?? `${artifact.id}-version-${artifact.versions.length + 1}`;
  return {
    ...artifact,
    title: normalizeOptionalText(patch.title) ?? artifact.title,
    description: patch.description ?? artifact.description,
    kind: patch.kind ?? artifact.kind,
    files: normalizeArtifactFiles(patch.files),
    references: patch.references ? normalizeReferences(patch.references) : [...artifact.references],
    updatedAt: timestamp,
    versions: [
      createArtifactVersion(artifact, { id: versionId, createdAt: timestamp }),
      ...artifact.versions.map(cloneArtifactVersion),
    ],
  };
}

export function resolveArtifactContext(
  artifacts: readonly AgentArtifact[],
  attachedArtifactIds: readonly string[],
): AgentArtifact[] {
  const byId = new Map(artifacts.map((artifact) => [artifact.id, artifact]));
  const resolved: AgentArtifact[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (artifactId: string) => {
    if (visited.has(artifactId)) return;
    const artifact = byId.get(artifactId);
    if (!artifact) throw new Error(`Unknown artifact reference: ${artifactId}`);
    if (visiting.has(artifactId)) return;
    visiting.add(artifactId);
    for (const referenceId of artifact.references) visit(referenceId);
    visiting.delete(artifactId);
    visited.add(artifactId);
    resolved.push(artifact);
  };

  for (const artifactId of attachedArtifactIds) visit(artifactId);
  return resolved;
}

export function buildArtifactPromptContext(
  artifacts: readonly AgentArtifact[],
  attachedArtifactIds: readonly string[],
): string {
  if (!attachedArtifactIds.length) return '';
  const resolved = resolveArtifactContext(artifacts, attachedArtifactIds);
  if (!resolved.length) return '';
  const sections = [
    'Active artifacts mounted at //artifacts. Treat them as standalone, versioned outputs; update or reference them by artifact id and file path when useful.',
  ];

  for (const artifact of resolved) {
    const lines = [
      `Artifact: ${artifact.title} (${artifact.id})`,
      `Updated: ${artifact.updatedAt}`,
      `Files: ${artifact.files.length}`,
    ];
    if (artifact.kind) lines.push(`Kind: ${artifact.kind}`);
    if (artifact.references.length) lines.push(`References: ${artifact.references.join(', ')}`);
    for (const file of artifact.files) {
      lines.push('');
      lines.push(`File: ${ARTIFACTS_DRIVE_NAME}/${artifact.id}/${file.path}`);
      lines.push(`Media type: ${file.mediaType ?? 'text/plain'}`);
      lines.push(file.content);
    }
    sections.push(lines.join('\n'));
  }

  return sections.join('\n\n');
}

export function createArtifactDownloadPayload(artifact: AgentArtifact): ArtifactDownloadPayload {
  if (artifact.files.length === 1) {
    const file = artifact.files[0];
    return {
      fileName: sanitizeDownloadFileName(basename(file.path)),
      mediaType: file.mediaType ?? 'application/octet-stream',
      data: file.content,
      kind: 'file',
    };
  }

  return {
    fileName: `${slugify(artifact.title || artifact.id)}.zip`,
    mediaType: 'application/zip',
    data: createZipArchive(artifact.files),
    kind: 'zip',
  };
}

export function isArtifactPanelSelection(value: unknown): value is ArtifactPanelSelection {
  if (!isRecord(value)) return false;
  return (
    typeof value.artifactId === 'string'
    && (value.filePath === undefined || value.filePath === null || typeof value.filePath === 'string')
  );
}

export function isArtifactContextBySession(value: unknown): value is Record<string, string[]> {
  return isRecord(value) && Object.values(value).every((entry) => Array.isArray(entry) && entry.every((id) => typeof id === 'string'));
}

export function isArtifactsByWorkspace(value: unknown): value is Record<string, AgentArtifact[]> {
  return isRecord(value) && Object.values(value).every((entry) => Array.isArray(entry) && entry.every(isAgentArtifact));
}

export function isAgentArtifact(value: unknown): value is AgentArtifact {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.title === 'string'
    && optionalString(value.description)
    && optionalString(value.kind)
    && optionalString(value.sourceSessionId)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && Array.isArray(value.files)
    && value.files.length > 0
    && value.files.every(isArtifactFile)
    && Array.isArray(value.references)
    && value.references.every((entry) => typeof entry === 'string')
    && Array.isArray(value.versions)
    && value.versions.every(isArtifactVersion)
  );
}

function isArtifactVersion(value: unknown): value is AgentArtifactVersion {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.title === 'string'
    && optionalString(value.description)
    && optionalString(value.kind)
    && Array.isArray(value.files)
    && value.files.length > 0
    && value.files.every(isArtifactFile)
    && Array.isArray(value.references)
    && value.references.every((entry) => typeof entry === 'string')
  );
}

function isArtifactFile(value: unknown): value is ArtifactFile {
  return (
    isRecord(value)
    && typeof value.path === 'string'
    && isSafeArtifactPath(value.path)
    && typeof value.content === 'string'
    && optionalString(value.mediaType)
    && optionalString(value.updatedAt)
  );
}

function normalizeArtifactFiles(files: readonly ArtifactFile[]): ArtifactFile[] {
  if (!files.length) throw new Error('Artifacts need at least one file.');
  return files.map((file) => ({
    path: normalizeArtifactPath(file.path),
    content: file.content,
    mediaType: file.mediaType ?? inferMediaType(file.path),
    ...(file.updatedAt ? { updatedAt: file.updatedAt } : {}),
  }));
}

function normalizeArtifactPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!isSafeArtifactPath(normalized)) {
    throw new Error('Artifact file paths must be relative paths without parent traversal.');
  }
  return normalized;
}

function isSafeArtifactPath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/').trim();
  return (
    normalized.length > 0
    && !normalized.startsWith('/')
    && !normalized.startsWith('//')
    && !/^[a-zA-Z]:\//.test(normalized)
    && normalized.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..')
  );
}

function normalizeReferences(references: readonly string[]): string[] {
  return [...new Set(references.map((reference) => normalizeArtifactId(reference)))];
}

function normalizeArtifactId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) throw new Error('Artifact id is required.');
  return trimmed;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function cloneArtifactFiles(files: readonly ArtifactFile[]): ArtifactFile[] {
  return files.map((file) => ({ ...file }));
}

function cloneArtifactVersion(version: AgentArtifactVersion): AgentArtifactVersion {
  return {
    ...version,
    files: cloneArtifactFiles(version.files),
    references: [...version.references],
  };
}

function sanitizeDownloadFileName(fileName: string): string {
  const sanitized = fileName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim();
  return sanitized || 'artifact';
}

function basename(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'artifact';
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'artifact';
}

function inferMediaType(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'html' || ext === 'htm') return 'text/html';
  if (ext === 'css') return 'text/css';
  if (ext === 'js' || ext === 'mjs') return 'text/javascript';
  if (ext === 'json') return 'application/json';
  if (ext === 'md' || ext === 'markdown') return 'text/markdown';
  if (ext === 'svg') return 'image/svg+xml';
  return 'text/plain';
}

function createZipArchive(files: readonly ArtifactFile[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = TEXT_ENCODER.encode(file.path);
    const dataBytes = TEXT_ENCODER.encode(file.content);
    const crc = crc32(dataBytes);
    const localHeader = zipLocalHeader(nameBytes, dataBytes.length, crc);
    localParts.push(localHeader, nameBytes, dataBytes);
    centralParts.push(zipCentralDirectoryHeader(nameBytes, dataBytes.length, crc, offset));
    offset += localHeader.length + nameBytes.length + dataBytes.length;
  }

  const centralOffset = offset;
  const centralDirectory = concatBytes(centralParts);
  const end = zipEndOfCentralDirectory(files.length, centralDirectory.length, centralOffset);
  return concatBytes([...localParts, centralDirectory, end]);
}

function zipLocalHeader(nameBytes: Uint8Array, size: number, crc: number): Uint8Array {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  writeDosDateTime(view, 10);
  view.setUint32(14, crc, true);
  view.setUint32(18, size, true);
  view.setUint32(22, size, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  return header;
}

function zipCentralDirectoryHeader(nameBytes: Uint8Array, size: number, crc: number, offset: number): Uint8Array {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  writeDosDateTime(view, 12);
  view.setUint32(16, crc, true);
  view.setUint32(20, size, true);
  view.setUint32(24, size, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, offset, true);
  return concatBytes([header, nameBytes]);
}

function zipEndOfCentralDirectory(fileCount: number, centralSize: number, centralOffset: number): Uint8Array {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, fileCount, true);
  view.setUint16(10, fileCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);
  return header;
}

function writeDosDateTime(view: DataView, offset: number): void {
  const year = Math.max(1980, ZIP_EPOCH.getUTCFullYear());
  const dosTime = (ZIP_EPOCH.getUTCHours() << 11) | (ZIP_EPOCH.getUTCMinutes() << 5) | Math.floor(ZIP_EPOCH.getUTCSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((ZIP_EPOCH.getUTCMonth() + 1) << 5) | ZIP_EPOCH.getUTCDate();
  view.setUint16(offset, dosTime, true);
  view.setUint16(offset + 2, dosDate, true);
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
