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
  const stored = normalizeStoredSettings(result[SETTINGS_KEY]);
  return ok({
    ...(stored.providerId ? { providerId: stored.providerId } : {}),
    ...(stored.baseUrl ? { baseUrl: stored.baseUrl } : {}),
    ...(stored.selectedModel ? { selectedModel: stored.selectedModel } : {}),
    hasStoredApiKey: typeof stored.apiKey === 'string' && stored.apiKey.length > 0,
  });
}

export async function clearSettings(storage: ChromeStorageAreaLike): Promise<ExtensionResult<{ cleared: true }>> {
  await storage.remove(SETTINGS_KEY);
  return ok({ cleared: true });
}

function normalizeStoredSettings(value: unknown): StoredSettings {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    ...storedString(record, 'providerId'),
    ...storedString(record, 'baseUrl'),
    ...storedString(record, 'selectedModel'),
    ...storedString(record, 'apiKey'),
  };
}

function storedString<TKey extends keyof StoredSettings>(
  record: Record<string, unknown>,
  key: TKey,
): Pick<StoredSettings, TKey> | Record<string, never> {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? { [key]: value } as Pick<StoredSettings, TKey> : {};
}
