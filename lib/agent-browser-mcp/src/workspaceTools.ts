import { ModelContext } from '../../webmcp/src/index';

import { registerBrowserPageSurface } from './browserPageTools';
import { registerClipboardTools } from './clipboardTools';
import { registerFilesystemTools } from './filesystemTools';
import { registerRendererViewportTools } from './rendererViewportTools';
import { registerWorkspaceIntrospectionTools } from './workspaceIntrospectionTools';
import { registerWorkspaceFileSurface } from './workspaceFileTools';
import { registerWorkspaceSessionTools } from './workspaceSessionTools';
import { registerWorktreeContextTools } from './worktreeContextTools';
import type {
  RegisterWorkspaceFileToolsOptions,
  RegisterWorkspaceToolsOptions,
} from './workspaceToolTypes';

export * from './workspaceToolTypes';
export {
  resolveWorkspaceFilePath,
  toWorkspaceFileUri,
} from './workspaceToolShared';
export { registerBrowserPageSurface } from './browserPageTools';
export { registerClipboardTools } from './clipboardTools';
export { registerFilesystemTools } from './filesystemTools';
export { registerRendererViewportTools } from './rendererViewportTools';
export { registerSessionTools } from './sessionTools';
export { registerSessionFilesystemTools } from './sessionFilesystemTools';
export { registerWorkspaceIntrospectionTools } from './workspaceIntrospectionTools';
export { registerWorkspaceFileSurface } from './workspaceFileTools';
export { registerWorkspaceSessionTools } from './workspaceSessionTools';
export { registerWorktreeContextTools } from './worktreeContextTools';

export function registerWorkspaceTools(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const { workspaceName, signal } = options;

  registerWorkspaceIntrospectionTools(modelContext, workspaceName, signal);
  registerWorkspaceFileSurface(modelContext, options);
  registerFilesystemTools(modelContext, options);
  registerBrowserPageSurface(modelContext, options);
  registerWorkspaceSessionTools(modelContext, options);
  registerWorktreeContextTools(modelContext, options);
  registerRendererViewportTools(modelContext, options);
  registerClipboardTools(modelContext, options);
}

export function registerWorkspaceFileTools(modelContext: ModelContext, options: RegisterWorkspaceFileToolsOptions): void {
  registerWorkspaceTools(modelContext, options);
}