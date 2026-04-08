import type { ModelProvider, ApiEndpoint } from '../types';

export const MODEL_PROVIDERS: ModelProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    color: '#f97316',
    status: 'not_configured',
    apiKey: '',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', enabled: true },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', enabled: true },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', enabled: false },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    color: '#22c55e',
    status: 'not_configured',
    apiKey: '',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', enabled: true },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', enabled: true },
      { id: 'o1-preview', name: 'o1 Preview', enabled: false },
    ],
  },
  {
    id: 'google',
    name: 'Google',
    color: '#3b82f6',
    status: 'not_configured',
    apiKey: '',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', enabled: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', enabled: true },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    color: '#8b5cf6',
    status: 'not_configured',
    apiKey: '',
    models: [
      { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', enabled: true },
      { id: 'mistralai/mistral-7b-instruct', name: 'Mistral 7B', enabled: true },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    color: '#6b7280',
    status: 'not_configured',
    apiKey: '',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', enabled: true },
      { id: 'mistral', name: 'Mistral', enabled: true },
    ],
  },
];

export const API_ENDPOINTS: Record<string, ApiEndpoint> = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    header: 'x-api-key',
    prefix: '',
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    header: 'Authorization',
    prefix: 'Bearer ',
  },
  google: {
    url: 'https://generativelanguage.googleapis.com/v1beta/models',
    header: 'x-goog-api-key',
    prefix: '',
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    header: 'Authorization',
    prefix: 'Bearer ',
  },
  ollama: {
    url: 'http://localhost:11434/api/chat',
    header: '',
    prefix: '',
  },
};
