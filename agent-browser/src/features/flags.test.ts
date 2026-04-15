import { describe, expect, it } from 'vitest';
import {
  getSandboxFeatureFlags,
  parseBooleanFlag,
  SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY,
  SECURE_BROWSER_SANDBOX_EXEC_FLAG,
} from './flags';

describe('sandbox feature flags', () => {
  it('keeps secure sandbox execution disabled by default', () => {
    expect(SECURE_BROWSER_SANDBOX_EXEC_FLAG).toBe('secure_browser_sandbox_exec');
    expect(getSandboxFeatureFlags({})).toEqual({
      secureBrowserSandboxExec: false,
      disableWebContainerAdapter: false,
      allowSameOriginForWebContainer: false,
    });
  });

  it('parses common truthy forms', () => {
    expect(parseBooleanFlag(true)).toBe(true);
    expect(parseBooleanFlag('true')).toBe(true);
    expect(parseBooleanFlag('YES')).toBe(true);
    expect(parseBooleanFlag('1')).toBe(true);
    expect(parseBooleanFlag('on')).toBe(true);
  });

  it('keeps falsey and unknown values disabled', () => {
    expect(parseBooleanFlag(false)).toBe(false);
    expect(parseBooleanFlag('0')).toBe(false);
    expect(parseBooleanFlag('false')).toBe(false);
    expect(parseBooleanFlag('no')).toBe(false);
    expect(parseBooleanFlag(undefined)).toBe(false);
    expect(parseBooleanFlag(null)).toBe(false);
  });

  it('reads the sandbox rollout and rollback controls from the environment', () => {
    expect(getSandboxFeatureFlags({
      VITE_SECURE_BROWSER_SANDBOX_EXEC: 'true',
      VITE_DISABLE_WEBCONTAINER_SANDBOX_ADAPTER: '1',
      VITE_ALLOW_SANDBOX_SAME_ORIGIN: 'yes',
    })).toEqual({
      secureBrowserSandboxExec: true,
      disableWebContainerAdapter: true,
      allowSameOriginForWebContainer: true,
    });
  });

  it('applies runtime overrides on top of the bundled environment defaults', () => {
    window.localStorage.setItem(SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY, JSON.stringify({
      VITE_SECURE_BROWSER_SANDBOX_EXEC: 'true',
    }));

    expect(getSandboxFeatureFlags({
      VITE_SECURE_BROWSER_SANDBOX_EXEC: 'false',
      VITE_DISABLE_WEBCONTAINER_SANDBOX_ADAPTER: 'false',
      VITE_ALLOW_SANDBOX_SAME_ORIGIN: 'false',
    })).toEqual({
      secureBrowserSandboxExec: true,
      disableWebContainerAdapter: false,
      allowSameOriginForWebContainer: false,
    });

    window.localStorage.removeItem(SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY);
  });
});
