import { ModelContext } from '@agent-harness/webmcp';

import { registerArtifactTools } from './artifactTools';
import { registerBrowserPageSurface } from './browserPageTools';
import { registerClipboardTools } from './clipboardTools';
import { registerFilesystemTools } from './filesystemTools';
import { registerHarnessUiTools } from './harnessUiTools';
import { registerRendererViewportTools } from './rendererViewportTools';
import { registerSearchTools } from './searchTools';
import { registerSettingsTools } from './settingsTools';
import { registerUserContextTools } from './userContextTools';
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
export { registerArtifactTools } from './artifactTools';
export { registerClipboardTools } from './clipboardTools';
export { registerFilesystemTools } from './filesystemTools';
export { registerHarnessUiTools } from './harnessUiTools';
export { registerRendererViewportTools } from './rendererViewportTools';
export { registerSearchTools } from './searchTools';
export { registerSettingsTools } from './settingsTools';
export { registerSessionTools } from './sessionTools';
export { registerSessionFilesystemTools } from './sessionFilesystemTools';
export { registerUserContextTools } from './userContextTools';
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
  registerArtifactTools(modelContext, options);
  registerHarnessUiTools(modelContext, options);
  registerClipboardTools(modelContext, options);
  registerUserContextTools(modelContext, options);
  registerSettingsTools(modelContext, options);
  registerSearchTools(modelContext, options);
}

export function registerWorkspaceFileTools(modelContext: ModelContext, options: RegisterWorkspaceFileToolsOptions): void {
  registerWorkspaceTools(modelContext, options);
}
