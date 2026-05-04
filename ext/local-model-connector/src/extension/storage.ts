import { ok, type ExtensionResult, type LocalModelSettingsResponse } from './types';
import { sanitizeSettings } from './validation';

export const SETTINGS_KEY = 'localModelConnector.settings';

export interface ChromeStorageAreaLike {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(values: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface StoredSettings {
  providerId?: string;
  baseUrl?: string;
  selectedModel?: string;
  apiKey?: string;
}

export async function saveSettings(
  storage: ChromeStorageAreaLike,
  value: unknown,
): Promise<ExtensionResult<{ saved: true }>> {
  const settings = sanitizeSettings(value);
  const stored: StoredSettings = {
    ...(settings.providerId ? { providerId: settings.providerId } : {}),
    ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
    ...(settings.selectedModel ? { selectedModel: settings.selectedModel } : {}),
    ...(settings.persistApiKey && settings.apiKey ? { apiKey: settings.apiKey } : {}),
  };
  await storage.set({ [SETTINGS_KEY]: stored });
  return ok({ saved: true });
}

export async function getSettings(storage: ChromeStorageAreaLike): Promise<ExtensionResult<LocalModelSettingsResponse>> {
  const result = await storage.get(SETTINGS_KEY);
  const stored = isStoredSettings(result[SETTINGS_KEY]) ? result[SETTINGS_KEY] : {};
  return ok({
    ...(stored.providerId ? { providerId: stored.providerId } : {}),
    ...(stored.baseUrl ? { baseUrl: stored.baseUrl } : {}),
    ...(stored.selectedModel ? { selectedModel: stored.selectedModel } : {}),
    hasStoredApiKey: Boolean(stored.apiKey),
  });
}

export async function clearSettings(storage: ChromeStorageAreaLike): Promise<ExtensionResult<{ cleared: true }>> {
  await storage.remove(SETTINGS_KEY);
  return ok({ cleared: true });
}

function isStoredSettings(value: unknown): value is StoredSettings {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
