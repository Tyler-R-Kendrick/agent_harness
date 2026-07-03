/**
 * Local redeclaration of the browser sandbox protocol `NetworkPolicy`
 * (`agent-browser/src/sandbox/protocol.ts`). Redeclared here so this library
 * has no dependency on `agent-browser` (agent-browser depends on the libs,
 * not the other way around).
 */
export type SandboxNetworkPolicyKind = 'deny' | 'restricted';

/**
 * Structural match of the sandbox protocol `RunLimits`
 * (`agent-browser/src/sandbox/protocol.ts`), with every field optional so a
 * policy can constrain a subset of the run limits. Redeclared locally to avoid
 * an `agent-browser` dependency.
 */
export interface SandboxRunLimits {
  maxRuntimeMs?: number;
  maxStdoutBytes?: number;
  maxStderrBytes?: number;
  maxLogBytes?: number;
  maxEventCount?: number;
  maxArtifactBytes?: number;
  maxWorkspaceBytes?: number;
}

/**
 * Structural match of `BrowserSandboxOptions.network`
 * (`lib/agent-sandbox/src/types.ts`) — the browser-enforceable network subset.
 */
export interface SandboxBrowserNetworkOptions {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowLocalhostHttp?: boolean;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
}

/**
 * Structural match of the enforceable subset of `BrowserSandboxOptions`
 * (`lib/agent-sandbox/src/types.ts`) — the compile target for the browser tier.
 * Non-enforceable/transport fields (`id`, `workerUrl`, `workerFactory`) are
 * intentionally omitted.
 */
export interface SandboxBrowserOptions {
  defaultTimeoutMs?: number;
  maxOutputBytes?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  allowNetwork?: boolean;
  network?: SandboxBrowserNetworkOptions;
}

/** Storage permission, mirroring the skill-manifest permission vocabulary. */
export type SandboxStorage = 'none' | 'skill-local';

/** Portable network scope of a {@link SandboxPolicy}. */
export interface SandboxPolicyNetwork {
  allow?: boolean;
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowLocalhostHttp?: boolean;
  policy?: SandboxNetworkPolicyKind;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
}

/**
 * Portable limits of a {@link SandboxPolicy}: the {@link SandboxRunLimits}
 * fields plus the browser-adapter byte/timeout ceilings.
 */
export interface SandboxPolicyLimits extends SandboxRunLimits {
  maxOutputBytes?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  defaultTimeoutMs?: number;
}

/**
 * The portable policy contract. Every top-level field is optional; an empty
 * policy compiles to safe, network-denied defaults. `enforcement` carries
 * server-tier OpenShell directives (filesystem, process, seccomp, landlock,
 * inference routing, ...) that the browser tier cannot enforce; they are
 * surfaced verbatim so nothing is silently dropped.
 */
export interface SandboxPolicy {
  network?: SandboxPolicyNetwork;
  limits?: SandboxPolicyLimits;
  storage?: SandboxStorage;
  dom?: false;
  enforcement?: Record<string, unknown>;
}

/** Compiled permission triple, mirroring `SkillManifest.permissions`. */
export interface SandboxPermissions {
  network: boolean;
  storage: SandboxStorage;
  dom: false;
}

/** Result of {@link compileSandboxPolicy}. */
export interface CompiledSandboxPolicy {
  browserOptions: SandboxBrowserOptions;
  networkPolicy: SandboxNetworkPolicyKind;
  limits: SandboxRunLimits;
  permissions: SandboxPermissions;
  unsupportedDirectives: string[];
}
