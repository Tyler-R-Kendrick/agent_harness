const MAX_FALLBACK_ID_COUNTER = 0x1000000;

let fallbackIdCounter = 0;

export function createUniqueId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }
  fallbackIdCounter = (fallbackIdCounter + 1) % MAX_FALLBACK_ID_COUNTER;
  return `id-${Date.now().toString(36)}-${fallbackIdCounter.toString(36).padStart(5, '0')}`;
}

export function createPrefixedId(prefix: string): string {
  return `${prefix}-${createUniqueId()}`;
}
