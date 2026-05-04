import { ok } from './types';
import { sanitizeSettings } from './validation';
export const SETTINGS_KEY = 'localModelConnector.settings';
export async function saveSettings(storage, value) {
    const settings = sanitizeSettings(value);
    const stored = {
        ...(settings.providerId ? { providerId: settings.providerId } : {}),
        ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
        ...(settings.selectedModel ? { selectedModel: settings.selectedModel } : {}),
        ...(settings.persistApiKey && settings.apiKey ? { apiKey: settings.apiKey } : {}),
    };
    await storage.set({ [SETTINGS_KEY]: stored });
    return ok({ saved: true });
}
export async function getSettings(storage) {
    const result = await storage.get(SETTINGS_KEY);
    const stored = normalizeStoredSettings(result[SETTINGS_KEY]);
    return ok({
        ...(stored.providerId ? { providerId: stored.providerId } : {}),
        ...(stored.baseUrl ? { baseUrl: stored.baseUrl } : {}),
        ...(stored.selectedModel ? { selectedModel: stored.selectedModel } : {}),
        hasStoredApiKey: typeof stored.apiKey === 'string' && stored.apiKey.length > 0,
    });
}
export async function clearSettings(storage) {
    await storage.remove(SETTINGS_KEY);
    return ok({ cleared: true });
}
function normalizeStoredSettings(value) {
    if (typeof value !== 'object' || value === null) {
        return {};
    }
    const record = value;
    return {
        ...storedString(record, 'providerId'),
        ...storedString(record, 'baseUrl'),
        ...storedString(record, 'selectedModel'),
        ...storedString(record, 'apiKey'),
    };
}
function storedString(record, key) {
    const value = record[key];
    return typeof value === 'string' && value.length > 0 ? { [key]: value } : {};
}
//# sourceMappingURL=storage.js.map