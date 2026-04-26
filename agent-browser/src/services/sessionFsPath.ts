export function normalizeSessionFsPath(path: string, options: { allowRoot?: boolean } = {}): string {
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) {
    throw new Error('Session filesystem paths must be absolute.');
  }

  const segments = trimmed.split('/').filter(Boolean);
  if (segments.length === 0) {
    if (options.allowRoot) {
      return '/';
    }
    throw new Error('Session filesystem root cannot be modified.');
  }

  for (const segment of segments) {
    if (segment === '.' || segment === '..') {
      throw new Error('Session filesystem paths cannot contain traversal segments.');
    }
    if (segment.includes('\\')) {
      throw new Error('Session filesystem paths cannot contain backslashes.');
    }
  }

  return `/${segments.join('/')}`;
}

export function normalizeSessionFsEntryName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Session filesystem entry names cannot be empty.');
  }
  if (trimmed === '.' || trimmed === '..') {
    throw new Error('Session filesystem entry names cannot be traversal segments.');
  }
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('Session filesystem entry names cannot contain path separators.');
  }
  return trimmed;
}

export function buildSessionFsChildPath(basePath: string, name: string): string {
  const normalizedBasePath = normalizeSessionFsPath(basePath, { allowRoot: true });
  const normalizedName = normalizeSessionFsEntryName(name);
  return normalizedBasePath === '/' ? `/${normalizedName}` : `${normalizedBasePath}/${normalizedName}`;
}

export function buildRenamedSessionFsPath(path: string, newName: string): string {
  const normalizedPath = normalizeSessionFsPath(path);
  const normalizedName = normalizeSessionFsEntryName(newName);
  const lastSlashIndex = normalizedPath.lastIndexOf('/');
  const parentPath = lastSlashIndex > 0 ? normalizedPath.slice(0, lastSlashIndex) : '/';
  return parentPath === '/' ? `/${normalizedName}` : `${parentPath}/${normalizedName}`;
}
