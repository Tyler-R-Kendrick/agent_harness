import { describe, expect, it } from 'vitest';
import type { CopilotRuntimeState } from '../services/copilotApi';
import type { CursorRuntimeState } from '../services/cursorApi';
import type { CodexRuntimeState } from '../services/codexApi';
import type { HFModel } from '../types';
import {
  getAgentDisplayName,
  getAgentInputPlaceholder,
  getAgentProviderSummary,
  getDefaultAgentProvider,
  resolveAgentModelIds,
  resolveAgentProviderForTask,
  resolveRuntimeAgentProvider,
} from './index';

function createCopilotState(overrides: Partial<CopilotRuntimeState> = {}): CopilotRuntimeState {
  return {
    available: true,
    authenticated: false,
    models: [],
    signInCommand: 'copilot login',
    signInDocsUrl: 'https://docs.github.com/copilot/how-tos/copilot-cli',
    ...overrides,
  };
}

function createCursorState(overrides: Partial<CursorRuntimeState> = {}): CursorRuntimeState {
  return {
    available: true,
    authenticated: false,
    models: [],
    signInCommand: 'Set CURSOR_API_KEY in the dev server environment',
    signInDocsUrl: 'https://cursor.com/blog/typescript-sdk',
    ...overrides,
  };
}

function createCodexState(overrides: Partial<CodexRuntimeState> = {}): CodexRuntimeState {
  return {
    available: true,
    authenticated: false,
    models: [],
    signInCommand: 'codex login',
    signInDocsUrl: 'https://developers.openai.com/codex/auth',
    ...overrides,
  };
}

const installedModels: HFModel[] = [{
  id: 'onnx-community/Qwen3-0.6B-ONNX',
  name: 'Qwen3-0.6B-ONNX',
  author: 'onnx-community',
  task: 'text-generation',
  downloads: 5000,
  likes: 30,
  tags: ['transformers.js'],
  sizeMB: 512,
  status: 'installed',
}];

describe('getDefaultAgentProvider', () => {
  it('defaults to Codi when a local model is installed', () => {
    const provider = getDefaultAgentProvider({
      installedModels,
      copilotState: createCopilotState({
        authenticated: true,
        models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
      }),
    });

    expect(provider).toBe('codi');
  });

  it('falls back to GHCP when no local models are installed and Copilot is ready', () => {
    const provider = getDefaultAgentProvider({
      installedModels: [],
      copilotState: createCopilotState({
        authenticated: true,
        models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
      }),
    });

    expect(provider).toBe('ghcp');
  });

  it('falls back to Cursor before GHCP when no local models are installed and Cursor is ready', () => {
    const provider = getDefaultAgentProvider({
      installedModels: [],
      copilotState: createCopilotState({
        authenticated: true,
        models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
      }),
      cursorState: createCursorState({
        authenticated: true,
        models: [{ id: 'composer-2', name: 'Composer 2' }],
      }),
    });

    expect(provider).toBe('cursor');
  });

  it('falls back to Codi when no agent is ready', () => {
    const provider = getDefaultAgentProvider({
      installedModels: [],
      copilotState: createCopilotState(),
    });

    expect(provider).toBe('codi');
  });
});

describe('agent helpers', () => {
  it('returns display names and placeholders for both agents', () => {
    expect(getAgentDisplayName({ provider: 'codi', activeCodiModelName: 'Qwen' })).toBe('Codi: Qwen');
    expect(getAgentDisplayName({ provider: 'codi' })).toBe('Codi: Codi');
    expect(getAgentDisplayName({ provider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('GHCP: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'ghcp' })).toBe('GHCP: Copilot');
    expect(getAgentDisplayName({ provider: 'cursor', activeCursorModelName: 'Composer 2' })).toBe('Cursor: Composer 2');
    expect(getAgentDisplayName({ provider: 'cursor' })).toBe('Cursor: Cursor');
    expect(getAgentDisplayName({ provider: 'codex', activeCodexModelName: 'Codex default' })).toBe('Codex: Codex default');
    expect(getAgentDisplayName({ provider: 'codex' })).toBe('Codex: Codex default');
    expect(getAgentDisplayName({ provider: 'researcher', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Researcher: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'researcher', researcherRuntimeProvider: 'codi', activeCodiModelName: 'Qwen' })).toBe('Researcher: Qwen');
    expect(getAgentDisplayName({ provider: 'debugger', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Debugger: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'planner', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Planner: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'security', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Security Review: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'adversary', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Adversary: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'media', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Media: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'swarm', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Swarm: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'tour-guide' })).toBe('Tour Guide');

    expect(getAgentInputPlaceholder({ provider: 'codi', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Codi…');
    expect(getAgentInputPlaceholder({ provider: 'codi', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Install a Codi model to start chatting');
    expect(getAgentInputPlaceholder({ provider: 'ghcp', hasCodiModelsReady: false, hasGhcpModelsReady: true })).toBe('Ask GHCP…');
    expect(getAgentInputPlaceholder({ provider: 'ghcp', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP to start chatting');
    expect(getAgentInputPlaceholder({ provider: 'cursor', hasCodiModelsReady: false, hasGhcpModelsReady: false, hasCursorModelsReady: true })).toBe('Ask Cursor…');
    expect(getAgentInputPlaceholder({ provider: 'cursor', hasCodiModelsReady: false, hasGhcpModelsReady: false, hasCursorModelsReady: false })).toBe('Sign in to Cursor to start chatting');
    expect(getAgentInputPlaceholder({ provider: 'codex', hasCodiModelsReady: false, hasGhcpModelsReady: false, hasCodexModelsReady: true })).toBe('Ask Codex…');
    expect(getAgentInputPlaceholder({ provider: 'codex', hasCodiModelsReady: false, hasGhcpModelsReady: false, hasCodexModelsReady: false })).toBe('Sign in to Codex to start chatting');
    expect(getAgentInputPlaceholder({ provider: 'researcher', hasCodiModelsReady: false, hasGhcpModelsReady: true })).toBe('Ask Researcher…');
    expect(getAgentInputPlaceholder({ provider: 'researcher', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or Cursor, or install a Codi model to research');
    expect(getAgentInputPlaceholder({ provider: 'debugger', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Debugger…');
    expect(getAgentInputPlaceholder({ provider: 'debugger', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or Cursor, or install a Codi model to debug');
    expect(getAgentInputPlaceholder({ provider: 'planner', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Planner…');
    expect(getAgentInputPlaceholder({ provider: 'planner', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or Cursor, or install a Codi model to plan');
    expect(getAgentInputPlaceholder({ provider: 'security', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Security Review…');
    expect(getAgentInputPlaceholder({ provider: 'security', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or Cursor, or install a Codi model to review security');
    expect(getAgentInputPlaceholder({ provider: 'adversary', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Adversary…');
    expect(getAgentInputPlaceholder({ provider: 'adversary', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or Cursor, or install a Codi model for adversary review');
    expect(getAgentInputPlaceholder({ provider: 'media', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Media…');
    expect(getAgentInputPlaceholder({ provider: 'media', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or Cursor, or install media-capable models');
    expect(getAgentInputPlaceholder({ provider: 'swarm', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Swarm…');
    expect(getAgentInputPlaceholder({ provider: 'swarm', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or Cursor, or install a Codi model for swarms');
    expect(getAgentInputPlaceholder({ provider: 'tour-guide', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Ask Tour Guide…');
  });

  it('builds provider summaries and resolves model ids', () => {
    expect(getAgentProviderSummary({
      provider: 'codi',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi models ready');

    expect(getAgentProviderSummary({
      provider: 'ghcp',
      installedModels: [],
      copilotState: createCopilotState({ authenticated: false, models: [] }),
    })).toBe('GHCP sign-in required');

    expect(getAgentProviderSummary({
      provider: 'ghcp',
      installedModels: [],
      copilotState: createCopilotState({ authenticated: true, models: [] }),
    })).toBe('GHCP has no enabled models');

    expect(getAgentProviderSummary({
      provider: 'ghcp',
      installedModels: [],
      copilotState: createCopilotState({ authenticated: true, models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }] }),
    })).toBe('1 GHCP models enabled');
    expect(getAgentProviderSummary({
      provider: 'cursor',
      installedModels: [],
      copilotState: createCopilotState(),
      cursorState: createCursorState({ authenticated: true, models: [{ id: 'composer-2', name: 'Composer 2' }] }),
    })).toBe('1 Cursor models enabled');
    expect(getAgentProviderSummary({
      provider: 'codex',
      installedModels: [],
      copilotState: createCopilotState(),
      codexState: createCodexState({ authenticated: true, models: [{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }] }),
    })).toBe('1 Codex models enabled');
    expect(getAgentProviderSummary({
      provider: 'researcher',
      installedModels: [],
      copilotState: createCopilotState({ authenticated: true, models: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }] }),
    })).toBe('1 GHCP-backed Researcher models');
    expect(getAgentProviderSummary({
      provider: 'researcher',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Researcher models');
    expect(getAgentProviderSummary({
      provider: 'researcher',
      installedModels: [],
      copilotState: createCopilotState(),
    })).toBe('Researcher needs GHCP, Cursor, or Codi');
    expect(getAgentProviderSummary({
      provider: 'debugger',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Debugger models');
    expect(getAgentProviderSummary({
      provider: 'planner',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Planner models');
    expect(getAgentProviderSummary({
      provider: 'security',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Security Review models');
    expect(getAgentProviderSummary({
      provider: 'adversary',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Adversary models');
    expect(getAgentProviderSummary({
      provider: 'media',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Media models');
    expect(getAgentProviderSummary({
      provider: 'swarm',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Swarm models');
    expect(getAgentProviderSummary({
      provider: 'tour-guide',
      installedModels: [],
      copilotState: createCopilotState(),
    })).toBe('Creates guided product tours');

    expect(resolveAgentModelIds({
      installedModels,
      selectedCodiModelId: 'missing',
      copilotModels: [{ id: 'gpt-4.1', name: 'GPT-4.1', reasoning: true, vision: true }],
      selectedGhcpModelId: 'missing',
      cursorModels: [{ id: 'composer-2', name: 'Composer 2' }],
      selectedCursorModelId: 'missing',
      codexModels: [{ id: 'codex-default', name: 'Codex default', reasoning: true, vision: false }],
      selectedCodexModelId: 'missing',
    })).toEqual({
      codiModelId: 'onnx-community/Qwen3-0.6B-ONNX',
      ghcpModelId: 'gpt-4.1',
      cursorModelId: 'composer-2',
      codexModelId: 'codex-default',
    });
  });

  it('routes research requests to Researcher and resolves its backing runtime', () => {
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Research current source quality guidance with citations.',
    })).toBe('researcher');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'cursor',
      latestUserInput: 'Say hello.',
    })).toBe('cursor');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Debug why uploads are failing after release.',
    })).toBe('debugger');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Research debugging practices with citations.',
    })).toBe('researcher');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Show me how to configure tools.',
    })).toBe('tour-guide');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Plan and orchestrate this delegated agent workflow.',
    })).toBe('planner');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Run a security review for auth regressions and prompt injection.',
    })).toBe('security');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Run an adversary pass that red-teams candidate answers.',
    })).toBe('adversary');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Generate image, voiceover, music, sfx, and a Remotion video.',
    })).toBe('media');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Use a squad of parallel agents to ship this asset workflow.',
    })).toBe('swarm');

    expect(resolveRuntimeAgentProvider({
      provider: 'researcher',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: true,
    })).toBe('ghcp');
    expect(resolveRuntimeAgentProvider({
      provider: 'researcher',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: false,
      hasCursorModelsReady: true,
    })).toBe('cursor');
    expect(resolveRuntimeAgentProvider({
      provider: 'researcher',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: false,
    })).toBe('codi');
    expect(resolveRuntimeAgentProvider({
      provider: 'codi',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: true,
    })).toBe('codi');
    expect(resolveRuntimeAgentProvider({
      provider: 'codex',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: true,
      hasCodexModelsReady: true,
    })).toBe('codex');
    expect(resolveRuntimeAgentProvider({
      provider: 'debugger',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: false,
    })).toBe('codi');
    expect(resolveRuntimeAgentProvider({
      provider: 'planner',
      hasCodiModelsReady: false,
      hasGhcpModelsReady: true,
    })).toBe('ghcp');
    expect(resolveRuntimeAgentProvider({
      provider: 'security',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: false,
    })).toBe('codi');
    expect(resolveRuntimeAgentProvider({
      provider: 'adversary',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: false,
    })).toBe('codi');
    expect(resolveRuntimeAgentProvider({
      provider: 'media',
      hasCodiModelsReady: false,
      hasGhcpModelsReady: true,
    })).toBe('ghcp');
    expect(resolveRuntimeAgentProvider({
      provider: 'swarm',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: false,
    })).toBe('codi');
  });
});
