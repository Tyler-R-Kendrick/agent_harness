export const SECURE_BROWSER_SANDBOX_EXEC_FLAG = 'secure_browser_sandbox_exec';
export const SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY = 'agent-browser.sandbox.flags';

export interface SandboxFeatureFlags {
  secureBrowserSandboxExec: boolean;
  disableWebContainerAdapter: boolean;
  allowSameOriginForWebContainer: boolean;
  /**
   * Phase 0 shadow flag for the external MCP client. Default off: when off the
   * MCP client is never constructed. When on, discovered tools are logged only
   * and NOT merged into the active tool set (zero behavior change to chat).
   * Optional so pre-existing flag literals remain valid; the resolver always
   * populates it.
   */
  mcpClientEnabled?: boolean;
}

type FlagEnvironment = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readRuntimeSandboxFlagOverrides(): FlagEnvironment {
  if (typeof window === 'undefined') {
    return {};
  }

  const globalOverrides = isRecord(window.__AGENT_BROWSER_FLAGS__) ? window.__AGENT_BROWSER_FLAGS__ : {};

  try {
    const serialized = window.localStorage.getItem(SANDBOX_RUNTIME_FLAG_OVERRIDES_STORAGE_KEY);
    if (!serialized) {
      return globalOverrides;
    }
    const parsed = JSON.parse(serialized);
    return isRecord(parsed)
      ? { ...globalOverrides, ...parsed }
      : globalOverrides;
  } catch {
    return globalOverrides;
  }
}

export function parseBooleanFlag(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return false;
  }

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true;
    default:
      return false;
  }
}

export function getSandboxFeatureFlags(
  environment: FlagEnvironment = import.meta.env,
  runtimeOverrides: FlagEnvironment = readRuntimeSandboxFlagOverrides(),
): SandboxFeatureFlags {
  const resolvedEnvironment = { ...environment, ...runtimeOverrides };
  return {
    secureBrowserSandboxExec: parseBooleanFlag(resolvedEnvironment.VITE_SECURE_BROWSER_SANDBOX_EXEC),
    disableWebContainerAdapter: parseBooleanFlag(resolvedEnvironment.VITE_DISABLE_WEBCONTAINER_SANDBOX_ADAPTER),
    allowSameOriginForWebContainer: parseBooleanFlag(resolvedEnvironment.VITE_ALLOW_SANDBOX_SAME_ORIGIN),
    mcpClientEnabled: parseBooleanFlag(resolvedEnvironment.VITE_MCP_CLIENT),
  };
}

declare global {
  interface Window {
    __AGENT_BROWSER_FLAGS__?: FlagEnvironment;
  }
}
