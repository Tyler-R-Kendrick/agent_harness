import {
  getModelContextPromptRegistry,
  getModelContextPromptTemplateRegistry,
  getModelContextRegistry,
  getModelContextResourceRegistry,
  invokeModelContextTool,
  ModelContext,
} from '../modelContext';
import { ModelContextClient } from '../modelContextClient';
import { TOOL_ACTIVATED_EVENT, TOOL_CANCELED_EVENT } from '../events';

function registerEchoTool(modelContext: ModelContext, overrides: Partial<Parameters<ModelContext['registerTool']>[0]> = {}) {
  const controller = new AbortController();
  const execute = vi.fn(async (input) => input);

  modelContext.registerTool(
    {
      name: 'echo',
      title: 'Echo',
      description: 'Echo input',
      inputSchema: {
        type: 'object',
        properties: {
          text: {
            description: 'Value to echo',
            type: 'string',
          },
        },
        required: ['text'],
      },
      execute,
      annotations: {
        readOnlyHint: 'true' as unknown as boolean,
      },
      ...overrides,
    },
    { signal: controller.signal },
  );

  return { controller, execute };
}

describe('ModelContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers and unregisters a tool with schema', () => {
    const modelContext = new ModelContext();
    const { controller } = registerEchoTool(modelContext);
    const registry = getModelContextRegistry(modelContext);

    expect(registry.list()).toEqual([
      expect.objectContaining({
        name: 'echo',
        title: 'Echo',
        description: 'Echo input',
        inputSchema: JSON.stringify({
          type: 'object',
          properties: {
            text: {
              description: 'Value to echo',
              type: 'string',
            },
          },
          required: ['text'],
        }),
        readOnlyHint: true,
      }),
    ]);

    controller.abort();
    expect(registry.list()).toEqual([]);
  });

  it('registers a tool with only required params', () => {
    const modelContext = new ModelContext();

    modelContext.registerTool({
      name: 'empty',
      description: 'echo empty',
      execute: () => undefined,
    });

    expect(getModelContextRegistry(modelContext).get('empty')).toEqual(
      expect.objectContaining({ inputSchema: '', readOnlyHint: false }),
    );
  });

  it('treats empty tool annotations as the default non-read-only contract', () => {
    const modelContext = new ModelContext();

    modelContext.registerTool({
      name: 'empty-annotations',
      description: 'echo input',
      execute: (input) => input,
      annotations: {},
    });

    expect(getModelContextRegistry(modelContext).get('empty-annotations')).toEqual(
      expect.objectContaining({
        inputSchema: '',
        readOnlyHint: false,
      }),
    );
  });

  it('accepts schemas whose toJSON returns a string value', () => {
    const modelContext = new ModelContext();

    modelContext.registerTool({
      name: 'stringified',
      description: 'stringified schema',
      inputSchema: {
        toJSON: () => 'undefined',
      },
      execute: () => undefined,
    });

    expect(getModelContextRegistry(modelContext).get('stringified')).toEqual(
      expect.objectContaining({ inputSchema: '"undefined"' }),
    );
  });

  it('rejects duplicate registrations', () => {
    const modelContext = new ModelContext();

    modelContext.registerTool({
      name: 'duplicate',
      description: 'first',
      execute: () => 'first',
    });

    expect(() => {
      modelContext.registerTool({
        name: 'duplicate',
        description: 'second',
        execute: () => 'second',
      });
    }).toThrow(/already registered/);
  });

  it('rejects empty or invalid tool names and empty descriptions', () => {
    const modelContext = new ModelContext();
    const tooLongName = 'a'.repeat(129);

    expect(() => {
      modelContext.registerTool({ name: '', description: 'desc', execute: () => undefined });
    }).toThrow(/must not be empty/);

    expect(() => {
      modelContext.registerTool({ name: 'valid', description: '', execute: () => undefined });
    }).toThrow(/must not be empty/);

    expect(() => {
      modelContext.registerTool({ name: 'not allowed!', description: 'desc', execute: () => undefined });
    }).toThrow(/ASCII alphanumeric/);

    expect(() => {
      modelContext.registerTool({ name: tooLongName, description: 'desc', execute: () => undefined });
    }).toThrow(/ASCII alphanumeric/);
  });

  it('throws for invalid input schemas', () => {
    const modelContext = new ModelContext();
    const circularSchema: Record<string, unknown> = {};
    circularSchema.self = circularSchema;

    expect(() => {
      modelContext.registerTool({
        name: 'undefined-schema',
        description: 'desc',
        inputSchema: { toJSON: () => undefined },
        execute: () => undefined,
      });
    }).toThrow(TypeError);

    expect(() => {
      modelContext.registerTool({
        name: 'circular-schema',
        description: 'desc',
        inputSchema: circularSchema,
        execute: () => undefined,
      });
    }).toThrow(TypeError);

    expect(() => {
      modelContext.registerTool({
        name: 'bigint-schema',
        description: 'desc',
        inputSchema: BigInt(42),
        execute: () => undefined,
      });
    }).toThrow(TypeError);

    expect(() => {
      modelContext.registerTool({
        name: 'explicit-undefined',
        description: 'desc',
        inputSchema: undefined,
        execute: () => undefined,
      });
    }).toThrow(TypeError);
  });

  it('validates schema before checking an aborted signal', () => {
    const modelContext = new ModelContext();
    const circularSchema: Record<string, unknown> = {};
    circularSchema.self = circularSchema;

    expect(() => {
      modelContext.registerTool(
        {
          name: 'aborted-invalid',
          description: 'desc',
          inputSchema: circularSchema,
          execute: () => undefined,
        },
        { signal: AbortSignal.abort('aborted') },
      );
    }).toThrow(TypeError);
  });

  it('does not register when the signal is already aborted', () => {
    const modelContext = new ModelContext();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    modelContext.registerTool(
      {
        name: 'aborted',
        description: 'desc',
        inputSchema: { type: 'object' },
        execute: () => undefined,
      },
      { signal: AbortSignal.abort('done') },
    );

    expect(getModelContextRegistry(modelContext).list()).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('invokes tools through the registry helper', async () => {
    const modelContext = new ModelContext();
    const { execute } = registerEchoTool(modelContext);
    const onActivate = vi.fn();

    modelContext.addEventListener(TOOL_ACTIVATED_EVENT, onActivate);

    const result = await invokeModelContextTool(modelContext, 'echo', { text: 'hello' });

    expect(result).toEqual({ text: 'hello' });
    expect(execute).toHaveBeenCalledWith({ text: 'hello' }, expect.any(ModelContextClient));
    expect(onActivate).toHaveBeenCalledOnce();
    expect((onActivate.mock.calls[0]?.[0] as Event & { detail?: { toolName: string } }).detail?.toolName).toBe('echo');
  });

  it('throws when invoking an unknown tool', async () => {
    const modelContext = new ModelContext();

    await expect(invokeModelContextTool(modelContext, 'missing', {})).rejects.toThrow(/not registered/);
  });

  it('dispatches cancelation when an invocation is aborted before execution', async () => {
    const modelContext = new ModelContext();
    const onCancel = vi.fn();
    modelContext.addEventListener(TOOL_CANCELED_EVENT, onCancel);

    modelContext.registerTool({
      name: 'abort-early',
      description: 'abort early',
      execute: () => 'never',
    });

    await expect(
      invokeModelContextTool(modelContext, 'abort-early', {}, new ModelContextClient(), { signal: AbortSignal.abort() }),
    ).rejects.toThrow(/aborted/i);

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('dispatches cancelation when an invocation is aborted mid-flight', async () => {
    const modelContext = new ModelContext();
    const controller = new AbortController();
    const onCancel = vi.fn();
    let resolveTool: ((value: string) => void) | undefined;

    modelContext.addEventListener(TOOL_CANCELED_EVENT, onCancel);
    modelContext.registerTool({
      name: 'abort-late',
      description: 'abort late',
      execute: () =>
        new Promise<string>((resolve) => {
          resolveTool = resolve;
        }),
    });

    const pending = invokeModelContextTool(modelContext, 'abort-late', {}, new ModelContextClient(), {
      signal: controller.signal,
    });

    controller.abort();
    resolveTool?.('done');

    await expect(pending).rejects.toThrow(/aborted/i);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('preserves tool failures when an invocation is not aborted', async () => {
    const modelContext = new ModelContext();
    const toolError = new Error('tool failed');

    modelContext.registerTool({
      name: 'fail',
      description: 'fail',
      execute: async () => {
        throw toolError;
      },
    });

    await expect(invokeModelContextTool(modelContext, 'fail', {}, new ModelContextClient())).rejects.toBe(toolError);
  });

  it('keeps abort as the rejection reason when an aborted invocation later fails', async () => {
    const modelContext = new ModelContext();
    const controller = new AbortController();
    let rejectTool: ((reason: Error) => void) | undefined;

    modelContext.registerTool({
      name: 'abort-before-failure',
      description: 'abort before failure',
      execute: () =>
        new Promise<string>((_, reject) => {
          rejectTool = reject;
        }),
    });

    const pending = invokeModelContextTool(modelContext, 'abort-before-failure', {}, new ModelContextClient(), {
      signal: controller.signal,
    });

    controller.abort();
    rejectTool?.(new Error('tool failed after cancellation'));

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('supports default and custom user interaction handlers', async () => {
    const defaultClient = new ModelContextClient();
    const customHandler = vi.fn(async <T,>(callback: () => T | Promise<T>) => callback());
    const customClient = new ModelContextClient({ onRequestUserInteraction: customHandler });

    await expect(defaultClient.requestUserInteraction(async () => 'default')).resolves.toBe('default');
    await expect(customClient.requestUserInteraction(async () => 'custom')).resolves.toBe('custom');
    expect(customHandler).toHaveBeenCalledOnce();
  });

  it('registers and unregisters resources, prompts, and prompt templates', async () => {
    const modelContext = new ModelContext();
    const resourceController = new AbortController();
    const promptController = new AbortController();
    const promptTemplateController = new AbortController();

    modelContext.registerResource({
      uri: 'files://workspace/AGENTS.md',
      title: 'AGENTS.md',
      description: 'Workspace rules',
      mimeType: 'text/markdown',
      read: async () => ({ uri: 'files://workspace/AGENTS.md', text: '# Rules' }),
    }, { signal: resourceController.signal });

    modelContext.registerPrompt({
      name: 'workspace-overview',
      title: 'Workspace overview',
      description: 'Summarize the workspace.',
      inputSchema: { type: 'object', properties: {} },
      render: async () => ({ messages: [{ role: 'system', content: 'Overview' }] }),
    }, { signal: promptController.signal });

    modelContext.registerPromptTemplate({
      name: 'workspace-file',
      title: 'Workspace file',
      description: 'Generate a file-specific prompt.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
      },
      render: async (input) => ({
        messages: [{ role: 'user', content: `Open ${(input as { path: string }).path}` }],
      }),
    }, { signal: promptTemplateController.signal });

    expect(getModelContextResourceRegistry(modelContext).list()).toEqual([
      expect.objectContaining({
        uri: 'files://workspace/AGENTS.md',
        title: 'AGENTS.md',
        description: 'Workspace rules',
        mimeType: 'text/markdown',
      }),
    ]);
    expect(getModelContextPromptRegistry(modelContext).list()).toEqual([
      expect.objectContaining({
        name: 'workspace-overview',
        title: 'Workspace overview',
        description: 'Summarize the workspace.',
        inputSchema: '{"type":"object","properties":{}}',
      }),
    ]);
    expect(getModelContextPromptTemplateRegistry(modelContext).list()).toEqual([
      expect.objectContaining({
        name: 'workspace-file',
        title: 'Workspace file',
        description: 'Generate a file-specific prompt.',
        inputSchema: '{"type":"object","properties":{"path":{"type":"string"}}}',
      }),
    ]);

    await expect(getModelContextResourceRegistry(modelContext).get('files://workspace/AGENTS.md')?.read(new ModelContextClient()))
      .resolves.toEqual({ uri: 'files://workspace/AGENTS.md', text: '# Rules' });
    await expect(getModelContextPromptRegistry(modelContext).get('workspace-overview')?.render({}, new ModelContextClient()))
      .resolves.toEqual({ messages: [{ role: 'system', content: 'Overview' }] });
    await expect(getModelContextPromptTemplateRegistry(modelContext).get('workspace-file')?.render({ path: 'AGENTS.md' }, new ModelContextClient()))
      .resolves.toEqual({ messages: [{ role: 'user', content: 'Open AGENTS.md' }] });

    resourceController.abort();
    promptController.abort();
    promptTemplateController.abort();

    expect(getModelContextResourceRegistry(modelContext).list()).toEqual([]);
    expect(getModelContextPromptRegistry(modelContext).list()).toEqual([]);
    expect(getModelContextPromptTemplateRegistry(modelContext).list()).toEqual([]);
  });

  it('registers resources, prompts, and prompt templates with only required params', () => {
    const modelContext = new ModelContext();

    modelContext.registerResource({
      uri: 'files://workspace/README.md',
      description: 'Workspace readme',
      read: async () => ({ uri: 'files://workspace/README.md', text: '# Readme' }),
    });
    modelContext.registerPrompt({
      name: 'plain-prompt',
      description: 'Prompt without schema',
      render: async () => ({ messages: [{ role: 'system', content: 'Plain prompt' }] }),
    });
    modelContext.registerPromptTemplate({
      name: 'plain-template',
      description: 'Template without schema',
      render: async () => ({ messages: [{ role: 'user', content: 'Plain template' }] }),
    });

    expect(getModelContextResourceRegistry(modelContext).get('files://workspace/README.md')).toEqual(
      expect.objectContaining({ mimeType: undefined }),
    );
    expect(getModelContextPromptRegistry(modelContext).get('plain-prompt')).toEqual(
      expect.objectContaining({ inputSchema: '' }),
    );
    expect(getModelContextPromptTemplateRegistry(modelContext).get('plain-template')).toEqual(
      expect.objectContaining({ inputSchema: '' }),
    );
  });

  it('rejects invalid resource URIs and invalid prompt registrations', () => {
    const modelContext = new ModelContext();

    expect(() => {
      modelContext.registerResource({ uri: '', description: 'desc', read: async () => null });
    }).toThrow(/must not be empty/);

    expect(() => {
      modelContext.registerResource({ uri: 'not a uri', description: 'desc', read: async () => null });
    }).toThrow(/valid absolute URI/);

    expect(() => {
      modelContext.registerPrompt({ name: '', description: 'desc', render: async () => ({ messages: [] }) });
    }).toThrow(/must not be empty/);

    expect(() => {
      modelContext.registerPromptTemplate({ name: 'invalid!', description: 'desc', render: async () => ({ messages: [] }) });
    }).toThrow(/ASCII alphanumeric/);
  });

  it('rejects duplicate resources, prompts, and prompt templates', () => {
    const modelContext = new ModelContext();

    modelContext.registerResource({ uri: 'files://workspace/AGENTS.md', description: 'desc', read: async () => null });
    modelContext.registerPrompt({ name: 'workspace-overview', description: 'desc', render: async () => ({ messages: [] }) });
    modelContext.registerPromptTemplate({ name: 'workspace-file', description: 'desc', render: async () => ({ messages: [] }) });

    expect(() => {
      modelContext.registerResource({ uri: 'files://workspace/AGENTS.md', description: 'desc', read: async () => null });
    }).toThrow(/already registered/);
    expect(() => {
      modelContext.registerPrompt({ name: 'workspace-overview', description: 'desc', render: async () => ({ messages: [] }) });
    }).toThrow(/already registered/);
    expect(() => {
      modelContext.registerPromptTemplate({ name: 'workspace-file', description: 'desc', render: async () => ({ messages: [] }) });
    }).toThrow(/already registered/);
  });

  it('validates prompt schemas and aborted registration for other WebMCP surface types', () => {
    const modelContext = new ModelContext();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() => {
      modelContext.registerPrompt({
        name: 'bad-prompt',
        description: 'desc',
        inputSchema: { toJSON: () => undefined },
        render: async () => ({ messages: [] }),
      });
    }).toThrow(TypeError);

    expect(() => {
      modelContext.registerPromptTemplate({
        name: 'bad-template',
        description: 'desc',
        inputSchema: undefined,
        render: async () => ({ messages: [] }),
      });
    }).toThrow(TypeError);

    modelContext.registerResource(
      { uri: 'files://workspace/aborted.md', description: 'desc', read: async () => null },
      { signal: AbortSignal.abort('done') },
    );
    modelContext.registerPrompt(
      { name: 'aborted-prompt', description: 'desc', render: async () => ({ messages: [] }) },
      { signal: AbortSignal.abort('done') },
    );
    modelContext.registerPromptTemplate(
      { name: 'aborted-template', description: 'desc', render: async () => ({ messages: [] }) },
      { signal: AbortSignal.abort('done') },
    );

    expect(getModelContextResourceRegistry(modelContext).list()).toEqual([]);
    expect(getModelContextPromptRegistry(modelContext).list()).toEqual([]);
    expect(getModelContextPromptTemplateRegistry(modelContext).list()).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(3);
  });
});
