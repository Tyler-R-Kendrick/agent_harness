import type {
  CompiledSandboxPolicy,
  SandboxBrowserNetworkOptions,
  SandboxBrowserOptions,
  SandboxNetworkPolicyKind,
  SandboxPermissions,
  SandboxPolicy,
  SandboxRunLimits,
} from './types';

/**
 * Explains why `CompiledSandboxPolicy.unsupportedDirectives` exists: directives
 * under `policy.enforcement` are server-tier-only and cannot be enforced by the
 * browser sandbox adapters, so they are surfaced rather than silently dropped.
 */
export const SANDBOX_POLICY_UNSUPPORTED_ENFORCEMENT_NOTE =
  'Directives under policy.enforcement (e.g. filesystem, process, seccomp, landlock, inferenceRouting) ' +
  'are server-tier-only. The browser sandbox adapters cannot enforce them, so they are surfaced in ' +
  'unsupportedDirectives instead of being silently dropped; server tiers enforce them natively.';

const RUN_LIMIT_FIELDS = [
  'maxRuntimeMs',
  'maxStdoutBytes',
  'maxStderrBytes',
  'maxLogBytes',
  'maxEventCount',
  'maxArtifactBytes',
  'maxWorkspaceBytes',
] as const;

function resolveNetworkPolicy(
  explicit: SandboxNetworkPolicyKind | undefined,
  allowNetwork: boolean,
): SandboxNetworkPolicyKind {
  if (explicit !== undefined) {
    return explicit;
  }
  return allowNetwork ? 'restricted' : 'deny';
}

/**
 * Compile a portable {@link SandboxPolicy} into the enforceable browser-tier
 * shape ({@link SandboxBrowserOptions}) plus the derived network policy, run
 * limits, permission triple, and the list of server-tier-only enforcement
 * directives the browser cannot honor.
 */
export function compileSandboxPolicy(policy: SandboxPolicy): CompiledSandboxPolicy {
  const network = policy.network ?? {};
  const limitsInput = policy.limits ?? {};

  const allowNetwork = network.allow === true;

  const browserOptions: SandboxBrowserOptions = {};
  browserOptions.allowNetwork = allowNetwork;

  const browserNetwork: SandboxBrowserNetworkOptions = {};
  if (network.allowedOrigins !== undefined) {
    browserNetwork.allowedOrigins = network.allowedOrigins;
  }
  if (network.allowedMethods !== undefined) {
    browserNetwork.allowedMethods = network.allowedMethods;
  }
  if (network.allowLocalhostHttp !== undefined) {
    browserNetwork.allowLocalhostHttp = network.allowLocalhostHttp;
  }
  if (network.maxRequestBytes !== undefined) {
    browserNetwork.maxRequestBytes = network.maxRequestBytes;
  }
  if (network.maxResponseBytes !== undefined) {
    browserNetwork.maxResponseBytes = network.maxResponseBytes;
  }
  if (network.timeoutMs !== undefined) {
    browserNetwork.timeoutMs = network.timeoutMs;
  }
  if (Object.keys(browserNetwork).length > 0) {
    browserOptions.network = browserNetwork;
  }

  if (limitsInput.maxOutputBytes !== undefined) {
    browserOptions.maxOutputBytes = limitsInput.maxOutputBytes;
  }
  if (limitsInput.maxFileBytes !== undefined) {
    browserOptions.maxFileBytes = limitsInput.maxFileBytes;
  }
  if (limitsInput.maxTotalBytes !== undefined) {
    browserOptions.maxTotalBytes = limitsInput.maxTotalBytes;
  }
  if (limitsInput.defaultTimeoutMs !== undefined) {
    browserOptions.defaultTimeoutMs = limitsInput.defaultTimeoutMs;
  }

  const limits: SandboxRunLimits = {};
  for (const field of RUN_LIMIT_FIELDS) {
    const raw = limitsInput[field];
    if (raw !== undefined) {
      limits[field] = raw;
    }
  }

  const permissions: SandboxPermissions = {
    network: allowNetwork,
    storage: policy.storage ?? 'none',
    dom: false,
  };

  const unsupportedDirectives = policy.enforcement ? Object.keys(policy.enforcement).sort() : [];

  return {
    browserOptions,
    networkPolicy: resolveNetworkPolicy(network.policy, allowNetwork),
    limits,
    permissions,
    unsupportedDirectives,
  };
}
