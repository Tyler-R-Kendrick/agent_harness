import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '../..');
const srcRoot = path.join(packageRoot, 'src');

function collectRootExports(source: string): string[] {
  return Array.from(
    source.matchAll(/^\s*export\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"][^'"]+['"];?/gm),
    (match) => match[1]
      .split(',')
      .map((name) => name.trim().split(/\s+as\s+/).pop() ?? '')
      .filter(Boolean),
  ).flat().sort();
}

function collectTypeScriptFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : collectTypeScriptFiles(entryPath);
    }

    return entry.isFile() && entry.name.endsWith('.ts') ? [entryPath] : [];
  });
}

describe('package boundaries', () => {
  it('keeps the root public API explicit', () => {
    const indexSource = fs.readFileSync(path.join(srcRoot, 'index.ts'), 'utf8');

    expect(indexSource).not.toMatch(/^\s*export\s+\*/m);
    expect(collectRootExports(indexSource)).toEqual([
      'RegisterSessionToolsOptions',
      'RegisterWorkspaceFileToolsOptions',
      'RegisterWorkspaceToolsOptions',
      'WEBMCP_BUILTIN_DESCRIPTOR',
      'WEBMCP_TOOL_ID',
      'WebMcpToolBridge',
      'WebMcpToolBridgeOptions',
      'WebMcpToolDescriptor',
      'WebMcpToolGroup',
      'WorkspaceMcpBrowserLocationResult',
      'WorkspaceMcpBrowserPage',
      'WorkspaceMcpBrowserPageHistory',
      'WorkspaceMcpBrowserPageHistoryEntry',
      'WorkspaceMcpClipboardEntry',
      'WorkspaceMcpContextAction',
      'WorkspaceMcpElicitationField',
      'WorkspaceMcpElicitationRequest',
      'WorkspaceMcpElicitationResult',
      'WorkspaceMcpFile',
      'WorkspaceMcpFilesystemEntry',
      'WorkspaceMcpFilesystemEntryKind',
      'WorkspaceMcpFilesystemHistoryRecord',
      'WorkspaceMcpFilesystemHistoryResult',
      'WorkspaceMcpFilesystemProperties',
      'WorkspaceMcpFilesystemTargetType',
      'WorkspaceMcpHarnessElement',
      'WorkspaceMcpHarnessElementPatch',
      'WorkspaceMcpHarnessElementSpec',
      'WorkspaceMcpReadWebPageRequest',
      'WorkspaceMcpReadWebPageResult',
      'WorkspaceMcpRenderPane',
      'WorkspaceMcpRenderPaneType',
      'WorkspaceMcpSearchWebRequest',
      'WorkspaceMcpSearchWebResult',
      'WorkspaceMcpSearchWebResultItem',
      'WorkspaceMcpSecretRequest',
      'WorkspaceMcpSecretRequestResult',
      'WorkspaceMcpSessionDrive',
      'WorkspaceMcpSessionFsEntry',
      'WorkspaceMcpSessionMessage',
      'WorkspaceMcpSessionState',
      'WorkspaceMcpSessionSummary',
      'WorkspaceMcpSessionTool',
      'WorkspaceMcpSessionToolState',
      'WorkspaceMcpUserContextMemory',
      'WorkspaceMcpUserContextMemoryResult',
      'WorkspaceMcpWebPageEntity',
      'WorkspaceMcpWebPageLink',
      'WorkspaceMcpWebPageObservation',
      'WorkspaceMcpWorktreeContextMenuState',
      'WorkspaceMcpWorktreeItem',
      'WorkspaceMcpWorktreeItemType',
      'WorkspaceMcpWorktreeRenderPaneState',
      'WorkspaceMcpWriteSessionInput',
      'createWebMcpTool',
      'createWebMcpToolBridge',
      'registerBrowserPageSurface',
      'registerClipboardTools',
      'registerFilesystemTools',
      'registerHarnessUiTools',
      'registerRendererViewportTools',
      'registerSearchTools',
      'registerSessionFilesystemTools',
      'registerSessionTools',
      'registerUserContextTools',
      'registerWorkspaceFileSurface',
      'registerWorkspaceFileTools',
      'registerWorkspaceIntrospectionTools',
      'registerWorkspaceSessionTools',
      'registerWorkspaceTools',
      'registerWorktreeContextTools',
      'resolveWorkspaceFilePath',
      'toWebMcpToolId',
      'toWorkspaceFileUri',
    ]);
  });

  it('uses webmcp through the workspace package entry point', () => {
    const imports = collectTypeScriptFiles(srcRoot).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return Array.from(source.matchAll(/from\s+['"]([^'"]+)['"]/g), (match) => ({
        file: path.relative(packageRoot, file),
        specifier: match[1],
      }));
    });

    expect(imports.filter((item) => item.specifier.includes('../webmcp'))).toEqual([]);
    expect(imports.filter((item) => item.specifier === 'webmcp')).toEqual([]);
    expect(imports.some((item) => item.specifier === '@agent-harness/webmcp')).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      files?: string[];
    };
    expect(packageJson.dependencies?.['@agent-harness/webmcp']).toBe('0.1.0');
    expect(packageJson.files).toEqual([
      'README.md',
      'src/**/*.ts',
      '!src/__tests__/**',
    ]);
  });
});
