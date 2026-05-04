import type { LocalProviderPreset } from './types';

export const LOCAL_PROVIDER_PRESETS: LocalProviderPreset[] = [
  {
    id: 'lm-studio',
    label: 'LM Studio',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    apiKeyRequired: false,
  },
  {
    id: 'ollama-openai',
    label: 'Ollama OpenAI-compatible API',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    apiKeyRequired: false,
  },
  {
    id: 'foundry-local',
    label: 'Foundry Local',
    defaultBaseUrl: 'http://127.0.0.1:<port>/v1',
    apiKeyRequired: false,
    notes: 'Requires the Foundry Local REST server to be running.',
  },
  {
    id: 'custom',
    label: 'Custom OpenAI-compatible endpoint',
    defaultBaseUrl: '',
    apiKeyRequired: false,
  },
];
