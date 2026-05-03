import { PromptRegistry, PromptTemplateRegistry, ResourceRegistry, ToolRegistry } from '../registry';
import type {
  RegisteredPromptDefinition,
  RegisteredPromptTemplateDefinition,
  RegisteredResourceDefinition,
  RegisteredToolDefinition,
} from '../types';

function createTool(name = 'echo'): RegisteredToolDefinition {
  return {
    name,
    title: 'Echo',
    description: 'Echo input',
    inputSchema: '{"type":"object"}',
    rawInputSchema: { type: 'object' },
    execute: async (input) => input,
    readOnlyHint: true,
  };
}

function createResource(uri = 'files://workspace/AGENTS.md'): RegisteredResourceDefinition {
  return {
    uri,
    title: 'AGENTS.md',
    description: 'Workspace rules',
    mimeType: 'text/markdown',
    read: async () => ({ uri, text: '# Rules' }),
  };
}

function createPrompt(name = 'workspace-overview'): RegisteredPromptDefinition {
  return {
    name,
    title: 'Workspace overview',
    description: 'Describe the current workspace.',
    inputSchema: '{"type":"object"}',
    rawInputSchema: { type: 'object' },
    render: async () => ({ messages: [{ role: 'system', content: 'Overview' }] }),
  };
}

function createPromptTemplate(name = 'workspace-file'): RegisteredPromptTemplateDefinition {
  return {
    name,
    title: 'Workspace file',
    description: 'Build a prompt for a workspace file.',
    inputSchema: '{"type":"object"}',
    rawInputSchema: { type: 'object' },
    render: async () => ({ messages: [{ role: 'user', content: 'Open AGENTS.md' }] }),
  };
}

describe('ToolRegistry', () => {
  it('registers, lists, retrieves, and unregisters tools', () => {
    const registry = new ToolRegistry();
    const tool = createTool();
    const changes: string[] = [];
    const unsubscribe = registry.subscribe((change) => {
      changes.push(`${change.type}:${change.tool.name}`);
    });

    registry.register(tool);

    expect(registry.has('echo')).toBe(true);
    expect(registry.get('echo')).toEqual(tool);
    expect(registry.list()).toEqual([tool]);

    expect(registry.unregister('echo')).toBe(true);
    expect(registry.unregister('echo')).toBe(false);
    expect(changes).toEqual(['register:echo', 'unregister:echo']);

    unsubscribe();
    registry.register(createTool('quiet'));
    expect(changes).toEqual(['register:echo', 'unregister:echo']);
  });
});

describe('ResourceRegistry', () => {
  it('registers, lists, retrieves, and unregisters resources', () => {
    const registry = new ResourceRegistry();
    const resource = createResource();
    const changes: string[] = [];
    const unsubscribe = registry.subscribe((change) => {
      changes.push(`${change.type}:${change.resource.uri}`);
    });

    registry.register(resource);

    expect(registry.has('files://workspace/AGENTS.md')).toBe(true);
    expect(registry.get('files://workspace/AGENTS.md')).toEqual(resource);
    expect(registry.list()).toEqual([resource]);

    expect(registry.unregister('files://workspace/AGENTS.md')).toBe(true);
    expect(registry.unregister('files://workspace/AGENTS.md')).toBe(false);
    expect(changes).toEqual([
      'register:files://workspace/AGENTS.md',
      'unregister:files://workspace/AGENTS.md',
    ]);

    unsubscribe();
    registry.register(createResource('files://workspace/quiet.md'));
    expect(changes).toEqual([
      'register:files://workspace/AGENTS.md',
      'unregister:files://workspace/AGENTS.md',
    ]);
  });
});

describe('PromptRegistry', () => {
  it('registers, lists, retrieves, and unregisters prompts', () => {
    const registry = new PromptRegistry();
    const prompt = createPrompt();
    const changes: string[] = [];
    const unsubscribe = registry.subscribe((change) => {
      changes.push(`${change.type}:${change.prompt.name}`);
    });

    registry.register(prompt);

    expect(registry.has('workspace-overview')).toBe(true);
    expect(registry.get('workspace-overview')).toEqual(prompt);
    expect(registry.list()).toEqual([prompt]);

    expect(registry.unregister('workspace-overview')).toBe(true);
    expect(registry.unregister('workspace-overview')).toBe(false);
    expect(changes).toEqual(['register:workspace-overview', 'unregister:workspace-overview']);

    unsubscribe();
    registry.register(createPrompt('quiet-prompt'));
    expect(changes).toEqual(['register:workspace-overview', 'unregister:workspace-overview']);
  });
});

describe('PromptTemplateRegistry', () => {
  it('registers, lists, retrieves, and unregisters prompt templates', () => {
    const registry = new PromptTemplateRegistry();
    const promptTemplate = createPromptTemplate();
    const changes: string[] = [];
    const unsubscribe = registry.subscribe((change) => {
      changes.push(`${change.type}:${change.promptTemplate.name}`);
    });

    registry.register(promptTemplate);

    expect(registry.has('workspace-file')).toBe(true);
    expect(registry.get('workspace-file')).toEqual(promptTemplate);
    expect(registry.list()).toEqual([promptTemplate]);

    expect(registry.unregister('workspace-file')).toBe(true);
    expect(registry.unregister('workspace-file')).toBe(false);
    expect(changes).toEqual(['register:workspace-file', 'unregister:workspace-file']);

    unsubscribe();
    registry.register(createPromptTemplate('quiet-template'));
    expect(changes).toEqual(['register:workspace-file', 'unregister:workspace-file']);
  });
});