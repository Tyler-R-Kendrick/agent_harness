import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RUNTIME_PLUGIN_SETTINGS,
  buildRuntimePluginPromptContext,
  buildRuntimePluginRuntime,
  evaluateRuntimePluginToolCall,
  isRuntimePluginSettings,
  type RuntimePluginManifest,
} from './runtimePlugins';

const repoPolicyPlugin: RuntimePluginManifest = {
  id: 'repo-policy',
  name: 'Repo policy',
  description: 'Policy hooks for repository-safe execution.',
  source: 'repo',
  tools: [{ id: 'policy.scan', name: 'Policy scan', description: 'Scan repository policy' }],
  providers: [{ id: 'policy-provider', name: 'Policy Provider', kind: 'auth' }],
  eventSubscriptions: ['tool:before-call', 'diagnostic:reported'],
  interceptsToolCalls: true,
  shellEnvironment: { AGENT_POLICY: 'strict' },
  compactionHint: 'Keep runtime plugin policy audit ids in compacted summaries.',
};

describe('runtimePlugins', () => {
  it('builds an active runtime from enabled plugin manifests', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        enabledPluginIds: ['repo-policy'],
      },
      manifests: [repoPolicyPlugin],
      selectedToolIds: ['read-file'],
    });

    expect(runtime.activePluginCount).toBe(1);
    expect(runtime.toolRegistrations).toEqual(repoPolicyPlugin.tools);
    expect(runtime.providerRegistrations).toEqual(repoPolicyPlugin.providers);
    expect(runtime.eventSubscriptions['tool:before-call']).toEqual(['repo-policy']);
    expect(runtime.shellEnvironment.AGENT_POLICY).toBe('strict');
    expect(runtime.compactionHints).toEqual(['Keep runtime plugin policy audit ids in compacted summaries.']);
  });

  it('omits active registrations when the runtime is disabled', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        enabled: false,
        enabledPluginIds: ['repo-policy'],
      },
      manifests: [repoPolicyPlugin],
      selectedToolIds: ['read-file'],
    });

    expect(runtime.activePluginCount).toBe(0);
    expect(runtime.toolRegistrations).toEqual([]);
    expect(buildRuntimePluginPromptContext(runtime)).toBe('');
  });

  it('blocks configured risky tools with an audit rationale', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        enabledPluginIds: ['repo-policy'],
        blockedToolIds: ['shell.exec'],
      },
      manifests: [repoPolicyPlugin],
      selectedToolIds: ['shell.exec'],
    });

    const decision = evaluateRuntimePluginToolCall({
      runtime,
      toolCall: { id: 'call-1', toolId: 'shell.exec', args: { command: 'rm -rf dist' } },
    });

    expect(decision.decision).toBe('block');
    expect(decision.auditEntry?.pluginId).toBe('repo-policy');
    expect(decision.auditEntry?.rationale).toContain('shell.exec');
    expect(decision.auditEntry?.originalToolId).toBe('shell.exec');
  });

  it('rewrites arguments through explicit rewrite rules', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        defaultInterceptionMode: 'rewrite',
        enabledPluginIds: ['repo-policy'],
        rewriteRules: ['shell.exec:command=npm.cmd run verify:agent-browser'],
      },
      manifests: [repoPolicyPlugin],
      selectedToolIds: ['shell.exec'],
    });

    const decision = evaluateRuntimePluginToolCall({
      runtime,
      toolCall: { id: 'call-2', toolId: 'shell.exec', args: { command: 'npm run verify:agent-browser' } },
    });

    expect(decision.decision).toBe('rewrite');
    expect(decision.rewrittenArgs).toEqual({ command: 'npm.cmd run verify:agent-browser' });
    expect(decision.auditEntry?.rewrittenArgs).toEqual({ command: 'npm.cmd run verify:agent-browser' });
  });

  it('validates persisted settings shape', () => {
    expect(isRuntimePluginSettings(DEFAULT_RUNTIME_PLUGIN_SETTINGS)).toBe(true);
    expect(isRuntimePluginSettings({
      enabled: true,
      defaultInterceptionMode: 'observe',
      requireRationale: true,
      enabledPluginIds: [2],
      blockedToolIds: [],
      rewriteRules: [],
    })).toBe(false);
    expect(isRuntimePluginSettings({
      ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
      defaultInterceptionMode: 'delete',
    })).toBe(false);
  });

  it('builds prompt context for active runtime policy', () => {
    const runtime = buildRuntimePluginRuntime({
      settings: {
        ...DEFAULT_RUNTIME_PLUGIN_SETTINGS,
        enabledPluginIds: ['repo-policy'],
      },
      manifests: [repoPolicyPlugin],
      selectedToolIds: ['shell.exec'],
    });

    const context = buildRuntimePluginPromptContext(runtime);

    expect(context).toContain('Runtime plugin policy: enabled');
    expect(context).toContain('Repo policy');
    expect(context).toContain('tool:before-call');
    expect(context).toContain('AGENT_POLICY');
  });
});
