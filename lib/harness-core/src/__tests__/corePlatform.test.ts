import { describe, expect, it, vi } from 'vitest';
import {
  HookRegistry,
  MemorySecretStore,
  CommandRegistry,
  ToolRegistry,
  buildAgentsPromptContext,
  createInferenceHook,
  createPromptTemplateTool,
  createSecretsManagerAgent,
  detectWorkspaceFileKind,
  discoverWorkspaceCapabilities,
  secretRefForId,
  validateWorkspaceFile,
} from '../index.js';

describe('harness-core platform contracts', () => {
  it('runs deterministic and inference hooks in priority order with mutable payloads', async () => {
    const registry = new HookRegistry<{ prompt: string }>();
    const infer = vi.fn(async ({ payload }: { payload: { prompt: string } }) => ({
      prompt: `${payload.prompt} + inferred`,
    }));
    const calls: string[] = [];

    registry.register({
      id: 'trim',
      point: 'before-inference',
      kind: 'deterministic',
      priority: 5,
      run: ({ payload }) => {
        calls.push('trim');
        return { payload: { prompt: payload.prompt.trim() } };
      },
    });
    registry.register(createInferenceHook({
      id: 'expand',
      point: 'before-inference',
      priority: 10,
      infer,
    }));
    registry.register({
      id: 'late',
      point: 'before-inference',
      priority: 20,
      run: ({ payload }) => {
        calls.push('late');
        return { stop: true, reason: payload.prompt };
      },
    });
    registry.register({
      id: 'skipped',
      point: 'before-inference',
      priority: 30,
      run: () => {
        calls.push('skipped');
      },
    });

    const result = await registry.run('before-inference', { prompt: '  summarize  ' });

    expect(result.payload).toEqual({ prompt: 'summarize + inferred' });
    expect(result.stopped).toBe(true);
    expect(result.reason).toBe('summarize + inferred');
    expect(calls).toEqual(['trim', 'late']);
    expect(infer).toHaveBeenCalledWith({
      point: 'before-inference',
      payload: { prompt: 'summarize' },
      metadata: {},
      signal: undefined,
    });
  });

  it('reports hook metadata, outputs, duplicate ids, and empty-point runs', async () => {
    const registry = new HookRegistry<string>();
    const signal = new AbortController().signal;

    registry.register({
      id: 'observe',
      point: 'after-tool',
      kind: 'deterministic',
      run: ({ payload, metadata, signal: hookSignal }) => ({
        payload: `${payload}:${metadata.toolName}:${hookSignal === signal}`,
        output: 'observed',
      }),
    });
    registry.register(createInferenceHook({
      id: 'noop-inference',
      point: 'after-tool',
      infer: () => undefined,
    }));

    await expect(registry.run('missing', 'payload')).resolves.toEqual({
      payload: 'payload',
      stopped: false,
      outputs: [],
    });
    await expect(registry.run('after-tool', 'payload', {
      metadata: { toolName: 'search' },
      signal,
    })).resolves.toEqual({
      payload: 'payload:search:true',
      stopped: false,
      outputs: [{ hookId: 'observe', output: 'observed' }],
    });
    expect(registry.get('observe')?.id).toBe('observe');
    expect(registry.list().map((hook) => hook.id)).toEqual(['observe', 'noop-inference']);
    expect(registry.forPoint('after-tool').map((hook) => hook.id)).toEqual(['observe', 'noop-inference']);
    expect(() => registry.register({
      id: 'observe',
      point: 'after-tool',
      kind: 'deterministic',
      run: () => undefined,
    })).toThrow(/already registered/i);
  });

  it('registers executable and prompt-template tools behind a standard registry', async () => {
    const registry = new ToolRegistry();
    registry.register({
      id: 'sum',
      description: 'Add two numbers.',
      inputSchema: {
        type: 'object',
        properties: {
          left: { type: 'number' },
          right: { type: 'number' },
        },
        required: ['left', 'right'],
      },
      execute: async (args) => {
        const { left, right } = args as { left: number; right: number };
        return { total: left + right };
      },
    });
    registry.register(createPromptTemplateTool({
      id: 'review-pr',
      description: 'Create review instructions.',
      template: ({ target }) => `Review ${String(target)} with tests first.`,
    }));

    await expect(registry.execute('sum', { left: 2, right: 3 })).resolves.toEqual({ total: 5 });
    await expect(registry.execute('review-pr', { target: 'PR #12' })).resolves.toEqual({
      type: 'prompt',
      prompt: 'Review PR #12 with tests first.',
    });
    await expect(registry.toToolSet().sum.execute?.({ left: 4, right: 5 })).resolves.toEqual({ total: 9 });
    expect(registry.list().map((tool) => tool.id)).toEqual(['sum', 'review-pr']);
    expect(registry.toToolSet().sum.description).toBe('Add two numbers.');
    expect(registry.has('sum')).toBe(true);
    expect(registry.get('sum')?.id).toBe('sum');
    expect(() => registry.register({ id: 'sum', description: 'duplicate' })).toThrow(/already registered/i);
    await expect(registry.execute('missing', {})).rejects.toThrow(/Unknown tool/i);
  });

  it('surfaces non-executable tools in model tool sets but rejects direct execution', async () => {
    const registry = new ToolRegistry();
    registry.register({ id: 'docs', description: 'Documentation prompt only.' });

    expect(registry.toToolSet()).toEqual({
      docs: { description: 'Documentation prompt only.' },
    });
    await expect(registry.execute('docs', {})).rejects.toThrow(/not executable/i);
  });

  it('executes commands through explicit regex matches and falls back to inference for args', async () => {
    const tools = new ToolRegistry();
    tools.register({
      id: 'search',
      description: 'Search docs.',
      execute: async (args) => ({ searched: (args as { query: string }).query }),
    });
    const registry = new CommandRegistry({ tools });
    const inferArgs = vi.fn(async () => ({ query: 'hooks from inference' }));

    registry.register({
      id: 'search',
      description: 'Run a direct search.',
      pattern: /^\/search(?:\s+(?<query>.*))?$/i,
      target: { type: 'tool', toolId: 'search' },
      parseArgs: ({ groups }) => groups.query ? { query: groups.query } : undefined,
    });
    registry.register({
      id: 'skill',
      description: 'Dispatch an agent skill directly.',
      pattern: /^\/skill\s+(?<name>[a-z-]+)\s*(?<input>.*)$/i,
      target: { type: 'agent-skill', skillName: ({ groups }) => groups.name, input: ({ groups }) => groups.input },
    });
    registry.register({
      id: 'help',
      description: 'Return static help.',
      pattern: /^\/help$/i,
      target: { type: 'prompt', prompt: 'Available commands.' },
    });
    registry.register({
      id: 'prompt-fn',
      description: 'Return dynamic help.',
      pattern: /^\/prompt-fn\s+(?<topic>.+)$/i,
      target: { type: 'prompt', prompt: (_args, { groups }) => `Dynamic ${groups.topic}.` },
    });
    registry.register({
      id: 'echo',
      description: 'Echo with a handler.',
      pattern: /^\/echo\s+(.+)$/i,
      target: { type: 'handler', run: (args) => ({ echoed: args.text }) },
      parseArgs: ({ match }) => ({ text: match[1] }),
    });
    registry.register({
      id: 'template',
      description: 'Render a prompt template.',
      pattern: /^\/template\s+(?<topic>.+)$/i,
      target: { type: 'prompt-template', template: (_args, { groups }) => `Explain ${groups.topic}.` },
    });
    registry.register({
      id: 'static-skill',
      description: 'Dispatch a static skill.',
      pattern: /^\/review$/i,
      target: { type: 'agent-skill', skillName: 'review-pr', input: 'current diff' },
    });

    await expect(registry.execute('/search AGENTS.md hooks')).resolves.toEqual({
      matched: true,
      commandId: 'search',
      result: { searched: 'AGENTS.md hooks' },
    });
    await expect(registry.execute('/search', { inferArgs })).resolves.toEqual({
      matched: true,
      commandId: 'search',
      result: { searched: 'hooks from inference' },
    });
    await expect(registry.execute('/skill review-pr src')).resolves.toEqual({
      matched: true,
      commandId: 'skill',
      result: { type: 'agent-skill', skillName: 'review-pr', input: 'src', args: {} },
    });
    await expect(registry.execute('/help')).resolves.toEqual({
      matched: true,
      commandId: 'help',
      result: { type: 'prompt', prompt: 'Available commands.', args: {} },
    });
    await expect(registry.execute('/prompt-fn secrets')).resolves.toEqual({
      matched: true,
      commandId: 'prompt-fn',
      result: { type: 'prompt', prompt: 'Dynamic secrets.', args: {} },
    });
    await expect(registry.execute('/echo hello')).resolves.toEqual({
      matched: true,
      commandId: 'echo',
      result: { echoed: 'hello' },
    });
    await expect(registry.execute('/template hooks')).resolves.toEqual({
      matched: true,
      commandId: 'template',
      result: { type: 'prompt', prompt: 'Explain hooks.', args: {} },
    });
    await expect(registry.execute('/review')).resolves.toEqual({
      matched: true,
      commandId: 'static-skill',
      result: { type: 'agent-skill', skillName: 'review-pr', input: 'current diff', args: {} },
    });
    expect(registry.list().map((command) => command.id)).toEqual(['search', 'skill', 'help', 'prompt-fn', 'echo', 'template', 'static-skill']);
    expect(registry.match('/help')?.match.groups).toEqual({});
    await expect(registry.execute('plain text')).resolves.toEqual({ matched: false });
    await expect(new CommandRegistry().execute('/missing-tools', {
      inferArgs: undefined,
    })).resolves.toEqual({ matched: false });
    const missingTools = new CommandRegistry();
    missingTools.register({
      id: 'needs-tool',
      description: 'Needs a registry.',
      pattern: /^\/needs-tool$/,
      target: { type: 'tool', toolId: 'missing' },
    });
    await expect(missingTools.execute('/needs-tool')).rejects.toThrow(/requires a tool registry/i);
    expect(inferArgs).toHaveBeenCalledWith(expect.objectContaining({ commandId: 'search', input: '/search' }));
    expect(() => registry.register({
      id: 'search',
      description: 'duplicate',
      pattern: /^\/s$/,
      target: { type: 'handler', run: () => undefined },
    })).toThrow(/already registered/i);
  });

  it('keeps secrets out of inference, restores refs for user rendering, and resolves tools just-in-time', async () => {
    const store = new MemorySecretStore();
    const secrets = createSecretsManagerAgent({
      store,
      idFactory: () => 'github-token',
      now: () => '2026-05-01T00:00:00.000Z',
    });
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz123456';

    const prepared = await secrets.prepareMessagesForInference([
      { role: 'user', content: `Use ${token}` },
    ]);

    expect(prepared.messages).toEqual([
      { role: 'user', content: 'Use secret-ref://local/github-token' },
    ]);
    expect(JSON.stringify(prepared.messages)).not.toContain(token);
    await expect(secrets.renderResponseToUser('Saved secret-ref://local/github-token')).resolves.toBe(`Saved ${token}`);

    const execute = vi.fn(async (args: unknown) => ({
      authorization: (args as { authorization: string }).authorization,
      leaked: token,
    }));
    const tools = secrets.wrapTools({
      request: {
        description: 'Send a request.',
        execute,
      },
    });
    await expect(tools.request.execute?.({ authorization: secretRefForId('github-token') })).resolves.toEqual({
      authorization: 'secret-ref://local/github-token',
      leaked: 'secret-ref://local/github-token',
    });
    expect(execute).toHaveBeenCalledWith({ authorization: token }, undefined);
  });

  it('discovers AGENTS.md instructions and workspace capability files for prompt context', () => {
    const files = [
      { path: 'AGENTS.md', content: '# Root\nUse TDD.', updatedAt: '2026-05-01T00:00:00.000Z' },
      { path: 'docs/AGENTS.md', content: '# Docs\nKeep examples current.', updatedAt: '2026-05-01T00:00:00.000Z' },
      {
        path: '.agents/skills/review-pr/SKILL.md',
        content: '---\nname: review-pr\ndescription: Review PRs.\n---\n\n# Review',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      { path: '.agents/hooks/pre-tool.sh', content: 'echo hook', updatedAt: '2026-05-01T00:00:00.000Z' },
      { path: '.agents/plugins/github/plugin.yaml', content: 'name: github', updatedAt: '2026-05-01T00:00:00.000Z' },
    ];

    const capabilities = discoverWorkspaceCapabilities(files);
    const prompt = buildAgentsPromptContext(files, { activeAgentPath: 'docs/AGENTS.md' });

    expect(detectWorkspaceFileKind('nested/AGENTS.md')).toBe('agents');
    expect(detectWorkspaceFileKind('.agents/skills/review-pr/SKILL.md')).toBe('skill');
    expect(validateWorkspaceFile({ path: '.agents/hooks/Bad.sh', content: '' })).toContain('kebab-case');
    expect(capabilities.agents.map((file) => file.path)).toEqual(['AGENTS.md', 'docs/AGENTS.md']);
    expect(capabilities.skills[0]).toEqual(expect.objectContaining({ name: 'review-pr', description: 'Review PRs.' }));
    expect(capabilities.hooks[0]).toEqual(expect.objectContaining({ name: 'pre-tool.sh' }));
    expect(capabilities.plugins[0]).toEqual(expect.objectContaining({ directory: 'github' }));
    expect(prompt).toContain('Active AGENTS.md:');
    expect(prompt).toContain('Keep examples current.');
    expect(prompt).toContain('Other AGENTS.md files:');
    expect(prompt).toContain('Use TDD.');
    expect(prompt).toContain('review-pr (.agents/skills/review-pr/SKILL.md): Review PRs.');
    expect(prompt).toContain('pre-tool.sh (.agents/hooks/pre-tool.sh)');
    expect(prompt).toContain('github (.agents/plugins/github/plugin.yaml)');
  });

  it('validates workspace capability paths and renders sparse capability contexts', () => {
    expect(buildAgentsPromptContext([])).toBe('No workspace capability files are currently stored.');
    expect(buildAgentsPromptContext([
      { path: '.memory/project.memory.md', content: '- Use Vitest.' },
      { path: '.agents/skills/missing-frontmatter/SKILL.md', content: '# Missing' },
    ])).toContain('Memory files:');

    expect(validateWorkspaceFile({ path: 'AGENTS.md', content: '' })).toBeNull();
    expect(validateWorkspaceFile({ path: 'README.md', content: '' })).toContain('Unsupported');
    expect(validateWorkspaceFile({ path: '.agents/skill/review-pr/SKILL.md', content: '' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/skills/Review PR/SKILL.md', content: '' })).toContain('kebab-case');
    expect(validateWorkspaceFile({ path: '.agents/skills/review-pr/nested/SKILL.md', content: '' })).toContain('<dir>/SKILL.md');
    expect(validateWorkspaceFile({ path: '.agents/skills/review-pr/README.md', content: '' })).toContain('Unsupported');
    expect(validateWorkspaceFile({ path: '.agents/hooks/pre/tool.sh', content: '' })).toContain('.agents/hooks/<name>.<ext>');
    expect(validateWorkspaceFile({ path: '.agents/hooks/pre-tool.sh', content: '' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/plugins/Bad/plugin.yaml', content: '' })).toContain('Plugin directories');
    expect(validateWorkspaceFile({ path: '.agents/plugins/github/plugin.yaml', content: '' })).toBeNull();
    expect(validateWorkspaceFile({ path: '.agents/plugins/github/other.txt', content: '' })).toContain('supported manifest');
    expect(validateWorkspaceFile({ path: '.agents/plugins/github/plugin.yaml/extra', content: '' })).toContain('<plugin>/<manifest>');
    expect(validateWorkspaceFile({ path: '.memory/project.memory.md', content: '' })).toBeNull();
    expect(buildAgentsPromptContext([
      { path: 'AGENTS.md', content: '# Root' },
    ])).toContain('AGENTS.md files:');
    expect(buildAgentsPromptContext([
      { path: 'AGENTS.md', content: '# Root' },
    ], { activeAgentPath: 'AGENTS.md' })).not.toContain('Other AGENTS.md files:');
    expect(buildAgentsPromptContext([
      { path: 'AGENTS.md', content: '# Root' },
    ], { activeAgentPath: 'missing/AGENTS.md' })).toContain('AGENTS.md files:');
    expect(discoverWorkspaceCapabilities([{
      path: '.agents/skills/no-description/SKILL.md',
      content: '---\nname: no-description\n---\n\n# Missing description',
    }]).skills[0]?.description).toBe('Skill file is missing required frontmatter.');
    expect(detectWorkspaceFileKind('README.md')).toBeNull();
  });
});
