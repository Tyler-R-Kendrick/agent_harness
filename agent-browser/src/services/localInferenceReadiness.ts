import type { HFModel } from '../types';

export type LocalInferenceStatus = 'ready' | 'needs-model' | 'limited';

export interface LocalInferenceHardware {
  deviceMemoryGB: number | null;
  logicalCores: number | null;
}

export interface LocalInferenceMetric {
  label: string;
  value: string;
}

export interface LocalInferenceReadiness {
  status: LocalInferenceStatus;
  title: string;
  summary: string;
  activeModelName: string | null;
  badge: string;
  badges: string[];
  constraints: string[];
  metrics: LocalInferenceMetric[];
}

interface AssessLocalInferenceReadinessInput {
  installedModels: HFModel[];
  selectedModelId?: string;
  hardware?: LocalInferenceHardware;
}

type BrowserHardwareNavigator = Navigator & {
  deviceMemory?: number;
};

const TEXT_GENERATION_TASKS = new Set(['text-generation', 'text2text-generation', 'summarization', 'translation']);

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function formatMemory(value: number | null): string {
  return isPositiveFiniteNumber(value) ? `${value} GB` : 'Unknown';
}

function formatModelSize(sizeMB: number): string {
  if (!isPositiveFiniteNumber(sizeMB)) return 'Unknown';
  if (sizeMB >= 1024) {
    const sizeGB = sizeMB / 1024;
    return `${Number.isInteger(sizeGB) ? sizeGB.toFixed(0) : sizeGB.toFixed(1)} GB`;
  }
  return `${Math.round(sizeMB)} MB`;
}

function formatTokenCount(value: number | undefined): string {
  return isPositiveFiniteNumber(value) ? `${Math.floor(value)} tokens` : 'Default';
}

function getInstalledChatModels(installedModels: HFModel[]): HFModel[] {
  return installedModels.filter((model) => model.status === 'installed' && TEXT_GENERATION_TASKS.has(model.task));
}

function pickActiveModel(installedModels: HFModel[], selectedModelId?: string): HFModel | null {
  const chatModels = getInstalledChatModels(installedModels);
  return chatModels.find((model) => model.id === selectedModelId) ?? chatModels[0] ?? null;
}

function buildConstraintList(model: HFModel | null, hardware: LocalInferenceHardware): string[] {
  const constraints = [
    'No localhost sidecar or hosted API is required once the ONNX model is cached in the browser.',
    'First run downloads model assets into the browser cache; later runs can work offline from that cache.',
    'Local Codi tool use is ReAct-style rather than native hosted-model function calling.',
  ];

  if (!model) {
    constraints.push('Hosted providers remain available while local inference waits for a browser-compatible ONNX text-generation model.');
    return constraints;
  }

  if (hardware.deviceMemoryGB !== null && hardware.deviceMemoryGB <= 4 && model.sizeMB >= 1024) {
    constraints.push('This model is large for the detected browser memory; close other tabs or choose a smaller quantized model.');
  } else if (model.sizeMB >= 1024) {
    constraints.push('Large local models can still pressure browser memory; close other tabs if generation stalls.');
  }

  return constraints;
}

export function getBrowserLocalInferenceHardware(navigatorRef: Navigator | null | undefined): LocalInferenceHardware {
  const browserNavigator = navigatorRef as BrowserHardwareNavigator | null | undefined;
  const deviceMemoryGB = isPositiveFiniteNumber(browserNavigator?.deviceMemory)
    ? browserNavigator.deviceMemory
    : null;
  const logicalCores = isPositiveFiniteNumber(browserNavigator?.hardwareConcurrency)
    ? browserNavigator.hardwareConcurrency
    : null;

  return {
    deviceMemoryGB,
    logicalCores,
  };
}

export function assessLocalInferenceReadiness({
  installedModels,
  selectedModelId = '',
  hardware = { deviceMemoryGB: null, logicalCores: null },
}: AssessLocalInferenceReadinessInput): LocalInferenceReadiness {
  const activeModel = pickActiveModel(installedModels, selectedModelId);
  const installedCount = installedModels.filter((model) => model.status === 'installed').length;
  const metrics: LocalInferenceMetric[] = [
    { label: 'Browser memory', value: formatMemory(hardware.deviceMemoryGB) },
    { label: 'CPU threads', value: hardware.logicalCores ? String(hardware.logicalCores) : 'Unknown' },
    { label: 'Model size', value: activeModel ? formatModelSize(activeModel.sizeMB) : 'None' },
    { label: 'Context window', value: activeModel ? formatTokenCount(activeModel.contextWindow) : 'None' },
  ];

  if (activeModel) {
    return {
      status: 'ready',
      title: 'Built-in local inference',
      summary: `${activeModel.name} is available as a browser-resident Codi model for local agent sessions.`,
      activeModelName: activeModel.name,
      badge: 'Offline ready',
      badges: ['Offline ready', 'No sidecar', 'Private by default'],
      constraints: buildConstraintList(activeModel, hardware),
      metrics,
    };
  }

  if (installedCount > 0) {
    return {
      status: 'limited',
      title: 'Built-in local inference',
      summary: `${installedCount} local model${installedCount === 1 ? '' : 's'} installed. Install a text-generation model to run Codi chat sessions offline.`,
      activeModelName: null,
      badge: 'Limited',
      badges: ['Local cache', 'No sidecar'],
      constraints: buildConstraintList(null, hardware),
      metrics,
    };
  }

  return {
    status: 'needs-model',
    title: 'Built-in local inference',
    summary: 'Install a browser-compatible ONNX text-generation model to run Codi without hosted-model execution.',
    activeModelName: null,
    badge: 'Install model',
    badges: ['Browser runtime', 'No sidecar'],
    constraints: buildConstraintList(null, hardware),
    metrics,
  };
}
