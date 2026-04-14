export const COPILOT_RUNTIME_URL = import.meta.env.VITE_COPILOT_RUNTIME_URL?.trim() ?? '';

export const COPILOT_RUNTIME_ENABLED = COPILOT_RUNTIME_URL.length > 0;
