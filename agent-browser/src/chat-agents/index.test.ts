import { describe, expect, it } from 'vitest';
import type { CopilotRuntimeState } from '../services/copilotApi';
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
    expect(getAgentDisplayName({ provider: 'researcher', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Researcher: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'researcher', researcherRuntimeProvider: 'codi', activeCodiModelName: 'Qwen' })).toBe('Researcher: Qwen');
    expect(getAgentDisplayName({ provider: 'debugger', researcherRuntimeProvider: 'ghcp', activeGhcpModelName: 'GPT-4.1' })).toBe('Debugger: GPT-4.1');
    expect(getAgentDisplayName({ provider: 'tour-guide' })).toBe('Tour Guide');

    expect(getAgentInputPlaceholder({ provider: 'codi', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Codi…');
    expect(getAgentInputPlaceholder({ provider: 'codi', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Install a Codi model to start chatting');
    expect(getAgentInputPlaceholder({ provider: 'ghcp', hasCodiModelsReady: false, hasGhcpModelsReady: true })).toBe('Ask GHCP…');
    expect(getAgentInputPlaceholder({ provider: 'ghcp', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP to start chatting');
    expect(getAgentInputPlaceholder({ provider: 'researcher', hasCodiModelsReady: false, hasGhcpModelsReady: true })).toBe('Ask Researcher…');
    expect(getAgentInputPlaceholder({ provider: 'researcher', hasCodiModelsReady: false, hasGhcpModelsReady: false })).toBe('Sign in to GHCP or install a Codi model to research');
    expect(getAgentInputPlaceholder({ provider: 'debugger', hasCodiModelsReady: true, hasGhcpModelsReady: false })).toBe('Ask Debugger…');
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
    })).toBe('Researcher needs GHCP or Codi');
    expect(getAgentProviderSummary({
      provider: 'debugger',
      installedModels,
      copilotState: createCopilotState(),
    })).toBe('1 Codi-backed Debugger models');
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
    })).toEqual({ codiModelId: 'onnx-community/Qwen3-0.6B-ONNX', ghcpModelId: 'gpt-4.1' });
  });

  it('routes research requests to Researcher and resolves its backing runtime', () => {
    expect(resolveAgentProviderForTask({
      selectedProvider: 'codi',
      latestUserInput: 'Research current source quality guidance with citations.',
    })).toBe('researcher');
    expect(resolveAgentProviderForTask({
      selectedProvider: 'ghcp',
      latestUserInput: 'Say hello.',
    })).toBe('ghcp');
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

    expect(resolveRuntimeAgentProvider({
      provider: 'researcher',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: true,
    })).toBe('ghcp');
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
      provider: 'debugger',
      hasCodiModelsReady: true,
      hasGhcpModelsReady: false,
    })).toBe('codi');
  });
});
