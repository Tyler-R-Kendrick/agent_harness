import { getModelContextRegistry, invokeModelContextTool, ModelContext } from '../modelContext';
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

  it('registers a tool with empty annotations', () => {
    const modelContext = new ModelContext();

    expect(() => {
      modelContext.registerTool({
        name: 'empty-annotations',
        description: 'echo input',
        execute: (input) => input,
        annotations: {},
      });
    }).not.toThrow();
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

  it('supports default and custom user interaction handlers', async () => {
    const defaultClient = new ModelContextClient();
    const customHandler = vi.fn(async <T,>(callback: () => T | Promise<T>) => callback());
    const customClient = new ModelContextClient({ onRequestUserInteraction: customHandler });

    await expect(defaultClient.requestUserInteraction(async () => 'default')).resolves.toBe('default');
    await expect(customClient.requestUserInteraction(async () => 'custom')).resolves.toBe('custom');
    expect(customHandler).toHaveBeenCalledOnce();
  });
});