import type { Bash } from 'just-bash/browser';
import type { ArtifactPersistenceRequest, ExecutionArtifact } from './protocol';

export interface WritableVirtualFileSystem {
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  writeFile(path: string, content: string, encoding?: 'utf-8' | 'utf8'): Promise<void>;
  getAllPaths?: () => string[];
}

function normalizeAbsolutePath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return `/${segments.join('/')}`;
}

function dirname(path: string): string {
  const normalized = normalizeAbsolutePath(path);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) {
    return '/';
  }
  return `/${parts.slice(0, -1).join('/')}`;
}

function joinPath(basePath: string, childPath: string): string {
  if (childPath.startsWith('/')) {
    return normalizeAbsolutePath(childPath);
  }
  return normalizeAbsolutePath(`${normalizeAbsolutePath(basePath)}/${childPath}`);
}

export async function persistArtifactsToVirtualFileSystem(
  fileSystem: WritableVirtualFileSystem,
  artifacts: ExecutionArtifact[],
  persistence: ArtifactPersistenceRequest,
): Promise<string[]> {
  if (persistence.mode !== 'just-bash' || artifacts.length === 0) {
    return [];
  }

  const rootDir = persistence.rootDir ? normalizeAbsolutePath(persistence.rootDir) : '/workspace';
  const writtenPaths: string[] = [];
  for (const artifact of artifacts) {
    const targetPath = joinPath(rootDir, artifact.path);
    await fileSystem.mkdir(dirname(targetPath), { recursive: true });
    await fileSystem.writeFile(targetPath, artifact.content, artifact.encoding === 'base64' ? undefined : 'utf-8');
    writtenPaths.push(targetPath);
  }
  return writtenPaths;
}

export async function persistArtifactsToBash(
  bash: Pick<Bash, 'fs'>,
  artifacts: ExecutionArtifact[],
  persistence: ArtifactPersistenceRequest,
): Promise<string[]> {
  return persistArtifactsToVirtualFileSystem(
    {
      mkdir: (path, options) => bash.fs.mkdir(path, options),
      writeFile: (path, content, encoding) => bash.fs.writeFile(path, content, encoding ?? 'utf-8'),
      getAllPaths: () => bash.fs.getAllPaths(),
    },
    artifacts,
    persistence,
  );
}
