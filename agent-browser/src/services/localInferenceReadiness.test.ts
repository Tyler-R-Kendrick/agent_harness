import { describe, expect, it } from 'vitest';
import type { HFModel } from '../types';
import {
  assessLocalInferenceReadiness,
  getBrowserLocalInferenceHardware,
} from './localInferenceReadiness';

const installedChatModel: HFModel = {
  id: 'onnx-community/Qwen3-0.6B-ONNX',
  name: 'Qwen3-0.6B-ONNX',
  author: 'onnx-community',
  task: 'text-generation',
  downloads: 5000,
  likes: 30,
  tags: ['transformers.js', 'onnx'],
  sizeMB: 768,
  contextWindow: 4096,
  maxOutputTokens: 512,
  status: 'installed',
};

describe('assessLocalInferenceReadiness', () => {
  it('marks Codi ready when an installed text-generation model can run in the browser', () => {
    const readiness = assessLocalInferenceReadiness({
      installedModels: [installedChatModel],
      selectedModelId: installedChatModel.id,
      hardware: { deviceMemoryGB: 8, logicalCores: 8 },
    });

    expect(readiness.status).toBe('ready');
    expect(readiness.activeModelName).toBe('Qwen3-0.6B-ONNX');
    expect(readiness.badge).toBe('Offline ready');
    expect(readiness.badges).toEqual(expect.arrayContaining(['Offline ready', 'No sidecar', 'Private by default']));
    expect(readiness.summary).toContain('browser-resident');
    expect(readiness.constraints.join(' ')).toContain('ReAct');
    expect(readiness.metrics).toEqual(expect.arrayContaining([
      { label: 'Browser memory', value: '8 GB' },
      { label: 'CPU threads', value: '8' },
      { label: 'Model size', value: '768 MB' },
      { label: 'Context window', value: '4096 tokens' },
    ]));
  });

  it('returns install guidance when no browser chat model is installed', () => {
    const readiness = assessLocalInferenceReadiness({
      installedModels: [],
      selectedModelId: '',
      hardware: { deviceMemoryGB: null, logicalCores: null },
    });

    expect(readiness.status).toBe('needs-model');
    expect(readiness.badge).toBe('Install model');
    expect(readiness.activeModelName).toBeNull();
    expect(readiness.summary).toContain('Install');
    expect(readiness.constraints).toContain('Hosted providers remain available while local inference waits for a browser-compatible ONNX text-generation model.');
  });

  it('flags limited readiness when only non-chat local models are installed', () => {
    const readiness = assessLocalInferenceReadiness({
      installedModels: [{ ...installedChatModel, task: 'text-classification', name: 'Sentiment model' }],
      selectedModelId: '',
      hardware: { deviceMemoryGB: 2, logicalCores: 2 },
    });

    expect(readiness.status).toBe('limited');
    expect(readiness.badge).toBe('Limited');
    expect(readiness.summary).toContain('Install a text-generation model');
  });

  it('uses selected installed text-generation model before the first installed model', () => {
    const selectedModel = {
      ...installedChatModel,
      id: 'onnx-community/Other-Model',
      name: 'Other Model',
      sizeMB: 1536,
    };

    const readiness = assessLocalInferenceReadiness({
      installedModels: [installedChatModel, selectedModel],
      selectedModelId: selectedModel.id,
      hardware: { deviceMemoryGB: 4, logicalCores: 4 },
    });

    expect(readiness.activeModelName).toBe('Other Model');
    expect(readiness.metrics).toContainEqual({ label: 'Model size', value: '1.5 GB' });
    expect(readiness.constraints.join(' ')).toContain('close other tabs');
  });
});

describe('getBrowserLocalInferenceHardware', () => {
  it('normalizes browser hardware hints when available', () => {
    const hardware = getBrowserLocalInferenceHardware({
      deviceMemory: 16,
      hardwareConcurrency: 12,
    } as unknown as Navigator);

    expect(hardware).toEqual({ deviceMemoryGB: 16, logicalCores: 12 });
  });

  it('returns null hints when navigator values are absent or invalid', () => {
    const hardware = getBrowserLocalInferenceHardware({
      deviceMemory: -1,
      hardwareConcurrency: 0,
    } as unknown as Navigator);

    expect(hardware).toEqual({ deviceMemoryGB: null, logicalCores: null });
  });
});
