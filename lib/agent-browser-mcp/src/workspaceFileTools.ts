import { ModelContext } from '../../webmcp/src/index';

import type { RegisterWorkspaceToolsOptions } from './workspaceToolTypes';
import type { WorkspaceFileInput } from './workspaceToolShared';
import {
  basename,
  detectMimeType,
  readWorkspaceFile,
  toWorkspaceFilePrompt,
  toWorkspaceFileUri,
  toWorkspaceOverviewMessages,
} from './workspaceToolShared';

export function registerWorkspaceFileSurface(modelContext: ModelContext, options: RegisterWorkspaceToolsOptions): void {
  const {
    workspaceName,
    workspaceFiles,
    signal,
  } = options;

  for (const file of workspaceFiles) {
    modelContext.registerResource({
      uri: toWorkspaceFileUri(file.path),
      title: basename(file.path),
      description: `Workspace file ${file.path} from ${workspaceName}.`,
      mimeType: detectMimeType(file.path),
      read: async () => ({
        uri: toWorkspaceFileUri(file.path),
        mimeType: detectMimeType(file.path),
        text: file.content,
      }),
    }, { signal });
  }

  modelContext.registerPrompt({
    name: 'workspace_overview',
    title: 'Workspace overview',
    description: `Prompt for summarizing the ${workspaceName} workspace.`,
    render: async () => toWorkspaceOverviewMessages(workspaceName, workspaceFiles),
  }, { signal });

  modelContext.registerPromptTemplate({
    name: 'workspace_file',
    title: 'Workspace file',
    description: `Prompt template for opening a specific workspace file in ${workspaceName}.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        uri: { type: 'string' },
      },
      anyOf: [{ required: ['path'] }, { required: ['uri'] }],
      additionalProperties: false,
    },
    render: async (input: object) => {
      const file = readWorkspaceFile(workspaceName, workspaceFiles, input as WorkspaceFileInput);
      return toWorkspaceFilePrompt(workspaceName, file);
    },
  }, { signal });
}