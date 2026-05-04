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
    const stored = isStoredSettings(result[SETTINGS_KEY]) ? result[SETTINGS_KEY] : {};
    return ok({
        ...(stored.providerId ? { providerId: stored.providerId } : {}),
        ...(stored.baseUrl ? { baseUrl: stored.baseUrl } : {}),
        ...(stored.selectedModel ? { selectedModel: stored.selectedModel } : {}),
        hasStoredApiKey: Boolean(stored.apiKey),
    });
}
export async function clearSettings(storage) {
    await storage.remove(SETTINGS_KEY);
    return ok({ cleared: true });
}
function isStoredSettings(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=storage.js.map