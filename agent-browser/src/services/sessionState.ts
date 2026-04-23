// Centralized session-bound persistence for agent-browser app state.
//
// Two backends:
//   - localStorage  → durable across tabs/restart (heavy, long-lived data)
//   - sessionStorage → per-tab, survives refresh only (transient UI state)
//
// All loaders are total: invalid/missing/corrupted payloads degrade to the
// caller-supplied fallback rather than throwing, so a bad write can never
// crash the app on next mount.

import { useCallback, useEffect, useRef, useState } from 'react';

export const STORAGE_KEYS = {
  // localStorage — durable
  installedModels: 'agent-browser.installed-models',
  // sessionStorage — per-tab, refresh-only
  selectedProviderBySession: 'agent-browser.session.selected-provider-by-session',
  selectedCodiModelBySession: 'agent-browser.session.selected-codi-model-by-session',
  selectedCopilotModelBySession: 'agent-browser.session.selected-copilot-model-by-session',
  activeWorkspaceId: 'agent-browser.session.active-workspace-id',
  activePanel: 'agent-browser.session.active-panel',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type Validator<T> = (value: unknown) => value is T;

export type SaveErrorHandler = (error: Error) => void;

const DEFAULT_DEBOUNCE_MS = 120;

export function loadJson<T>(
  backend: StorageBackend,
  key: string,
  validate: Validator<T>,
  fallback: T,
): T {
  let raw: string | null;
  try {
    raw = backend.getItem(key);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  return validate(parsed) ? parsed : fallback;
}

export function saveJson<T>(
  backend: StorageBackend,
  key: string,
  value: T,
  onError?: SaveErrorHandler,
): void {
  try {
    backend.setItem(key, JSON.stringify(value));
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export type UseStoredStateOptions = {
  /** Debounce window before persisting changes. Defaults to 120ms. */
  debounceMs?: number;
  /** Invoked when a write to storage fails (e.g. quota exceeded). */
  onError?: SaveErrorHandler;
};

/**
 * Drop-in replacement for `useState<T>` that hydrates from `backend[key]`
 * on first mount and writes subsequent values back (debounced).
 */
export function useStoredState<T>(
  backend: StorageBackend | null | undefined,
  key: string,
  validate: Validator<T>,
  fallback: T,
  options: UseStoredStateOptions = {},
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { debounceMs = DEFAULT_DEBOUNCE_MS, onError } = options;

  const [value, setValue] = useState<T>(() =>
    backend ? loadJson(backend, key, validate, fallback) : fallback,
  );

  // Skip the very first effect so we don't re-write the value we just hydrated.
  const hydrated = useRef(false);

  const onErrorRef = useRef<SaveErrorHandler | undefined>(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!backend) return;
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    const handle = setTimeout(() => {
      saveJson(backend, key, value, onErrorRef.current);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [backend, key, value, debounceMs]);

  // Stable setter identity for callers passing it down as a prop.
  const stableSetValue = useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (next) => setValue(next),
    [],
  );

  return [value, stableSetValue];
}

// ── Common validators ────────────────────────────────────────────────────────

export const isString = (value: unknown): value is string => typeof value === 'string';

export function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string')
  );
}
