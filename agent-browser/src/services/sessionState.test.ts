import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEYS,
  loadJson,
  saveJson,
  useStoredState,
} from './sessionState';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('STORAGE_KEYS', () => {
  it('namespaces every key under agent-browser.', () => {
    for (const value of Object.values(STORAGE_KEYS)) {
      expect(value.startsWith('agent-browser.')).toBe(true);
    }
  });

  it('lists the categories that should survive a page refresh', () => {
    expect(STORAGE_KEYS).toMatchObject({
      installedModels: expect.any(String),
      selectedProviderBySession: expect.any(String),
      selectedCodiModelBySession: expect.any(String),
      selectedCopilotModelBySession: expect.any(String),
      activeWorkspaceId: expect.any(String),
      activePanel: expect.any(String),
    });
  });
});

describe('loadJson', () => {
  it('returns the fallback when the key is missing', () => {
    expect(loadJson(window.localStorage, 'missing', isStringArray, ['default'])).toEqual(['default']);
  });

  it('returns the fallback when the stored payload is not valid JSON', () => {
    window.localStorage.setItem('broken', '{not-json');
    expect(loadJson(window.localStorage, 'broken', isStringArray, ['fallback'])).toEqual(['fallback']);
  });

  it('returns the fallback when the validator rejects the parsed payload', () => {
    window.localStorage.setItem('shape', JSON.stringify({ unexpected: true }));
    expect(loadJson(window.localStorage, 'shape', isStringArray, [])).toEqual([]);
  });

  it('returns the parsed value when the validator accepts it', () => {
    window.localStorage.setItem('ok', JSON.stringify(['a', 'b']));
    expect(loadJson(window.localStorage, 'ok', isStringArray, [])).toEqual(['a', 'b']);
  });
});

describe('saveJson', () => {
  it('writes JSON to the backend', () => {
    saveJson(window.sessionStorage, 'k', { a: 1 });
    expect(window.sessionStorage.getItem('k')).toBe(JSON.stringify({ a: 1 }));
  });

  it('invokes onError when setItem throws (e.g. quota exceeded)', () => {
    const onError = vi.fn();
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    saveJson(failing, 'k', [1], onError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});

describe('useStoredState', () => {
  it('hydrates from storage on mount when a value is present', () => {
    window.localStorage.setItem('hydrated', JSON.stringify(['installed-1']));
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'hydrated', isStringArray, [] as string[]),
    );
    expect(result.current[0]).toEqual(['installed-1']);
  });

  it('uses the fallback when storage is empty', () => {
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'fresh', isStringArray, ['default']),
    );
    expect(result.current[0]).toEqual(['default']);
  });

  it('persists the next value to storage when set', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'writes', isStringArray, [] as string[]),
    );

    act(() => {
      result.current[1](['next']);
    });
    act(() => {
      vi.runAllTimers();
    });

    expect(JSON.parse(window.localStorage.getItem('writes') ?? 'null')).toEqual(['next']);
  });

  it('falls back to the default when the stored value fails validation', () => {
    window.localStorage.setItem('bad', JSON.stringify({ unexpected: true }));
    const { result } = renderHook(() =>
      useStoredState(window.localStorage, 'bad', isStringArray, ['default']),
    );
    expect(result.current[0]).toEqual(['default']);
  });
});
