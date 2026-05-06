import type { SubjectRef, ProjectRef } from './provider';
import type { WorkerDescriptor, WorkerJob } from './worker';
import type { SandboxDescriptor } from './sandbox';

export interface NetworkPolicyRequest {
  mode?: 'none' | 'allowlist' | 'direct';
  allowedHosts?: string[];
}

export interface NetworkPolicy {
  mode: 'none' | 'allowlist' | 'direct';
  allowedHosts: string[];
}

export interface FilesystemPolicyRequest {
  mode?: 'none' | 'virtual' | 'workspace-scoped';
  readRoots?: string[];
  writeRoots?: string[];
  maxFileBytes?: number;
  maxTotalBytes?: number;
}

export interface FilesystemPolicy {
  mode: 'none' | 'virtual' | 'workspace-scoped';
  readRoots: string[];
  writeRoots: string[];
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface ExecutionPolicyRequest {
  timeoutMs?: number;
  maxOutputBytes?: number;
  maxMemoryBytes?: number;
}

export interface ExecutionPolicy {
  timeoutMs: number;
  maxOutputBytes: number;
  maxMemoryBytes?: number;
}

export interface SecretPolicyRequest {
  mode?: 'none' | 'brokered';
  allowedSecretRefs?: string[];
}

export interface SecretPolicy {
  mode: 'none' | 'brokered';
  allowedSecretRefs: string[];
}

export interface PreviewPolicyRequest {
  enabled?: boolean;
  mode?: string;
}

export interface PreviewPolicy {
  enabled: boolean;
  mode: string;
}

export interface PolicyRequest {
  network?: NetworkPolicyRequest;
  filesystem?: FilesystemPolicyRequest;
  execution?: ExecutionPolicyRequest;
  secrets?: SecretPolicyRequest;
  preview?: PreviewPolicyRequest;
  extensions?: Record<string, unknown>;
}

export interface EffectivePolicy {
  network: NetworkPolicy;
  filesystem: FilesystemPolicy;
  execution: ExecutionPolicy;
  secrets: SecretPolicy;
  preview: PreviewPolicy;
  extensions?: Record<string, unknown>;
}

export interface PolicyEvaluationRequest {
  job?: WorkerJob;
  worker?: WorkerDescriptor;
  sandbox?: SandboxDescriptor;
  requestedPolicy?: PolicyRequest;
  subject?: SubjectRef;
  project?: ProjectRef;
}

export interface PolicyDecision {
  allowed: boolean;
  effectivePolicy?: EffectivePolicy;
  reasons: string[];
}

export interface PolicyEngine {
  evaluate(request: PolicyEvaluationRequest): Promise<PolicyDecision>;
}

export interface DefaultPolicyEngineOptions {
  allowedNetworkModes?: NetworkPolicy['mode'][];
  allowWorkspaceFilesystem?: boolean;
  allowBrokeredSecrets?: boolean;
  allowPreview?: boolean;
  defaults?: PartialPolicyDefaults;
}

interface PartialPolicyDefaults {
  network?: Partial<NetworkPolicy>;
  filesystem?: Partial<FilesystemPolicy>;
  execution?: Partial<ExecutionPolicy>;
  secrets?: Partial<SecretPolicy>;
  preview?: Partial<PreviewPolicy>;
}

const DEFAULT_POLICY: EffectivePolicy = {
  network: {
    mode: 'none',
    allowedHosts: [],
  },
  filesystem: {
    mode: 'virtual',
    readRoots: [],
    writeRoots: [],
    maxFileBytes: 5 * 1024 * 1024,
    maxTotalBytes: 50 * 1024 * 1024,
  },
  execution: {
    timeoutMs: 30_000,
    maxOutputBytes: 1_000_000,
  },
  secrets: {
    mode: 'none',
    allowedSecretRefs: [],
  },
  preview: {
    enabled: false,
    mode: 'none',
  },
};

export class DefaultPolicyEngine implements PolicyEngine {
  private readonly allowedNetworkModes: Set<NetworkPolicy['mode']>;
  private readonly allowWorkspaceFilesystem: boolean;
  private readonly allowBrokeredSecrets: boolean;
  private readonly allowPreview: boolean;
  private readonly defaults: EffectivePolicy;

  constructor(options: DefaultPolicyEngineOptions = {}) {
    this.allowedNetworkModes = new Set(options.allowedNetworkModes ?? ['none']);
    this.allowWorkspaceFilesystem = options.allowWorkspaceFilesystem ?? false;
    this.allowBrokeredSecrets = options.allowBrokeredSecrets ?? false;
    this.allowPreview = options.allowPreview ?? false;
    this.defaults = mergeDefaults(options.defaults);
  }

  async evaluate(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
    const effectivePolicy = applyRequest(this.defaults, request.requestedPolicy ?? {});
    const reasons = this.findDenials(effectivePolicy);

    return {
      allowed: reasons.length === 0,
      effectivePolicy: reasons.length === 0 ? effectivePolicy : undefined,
      reasons,
    };
  }

  private findDenials(policy: EffectivePolicy): string[] {
    const reasons: string[] = [];
    if (!this.allowedNetworkModes.has(policy.network.mode)) {
      reasons.push(`${policy.network.mode} network is not allowed by policy configuration.`);
    }
    if (policy.filesystem.mode === 'workspace-scoped' && !this.allowWorkspaceFilesystem) {
      reasons.push('workspace filesystem access is not allowed by policy configuration.');
    }
    if (policy.secrets.mode === 'brokered' && !this.allowBrokeredSecrets) {
      reasons.push('brokered secrets are not allowed by policy configuration.');
    }
    if (policy.preview.enabled && !this.allowPreview) {
      reasons.push('preview access is not allowed by policy configuration.');
    }
    return reasons;
  }
}

function mergeDefaults(defaults: PartialPolicyDefaults = {}): EffectivePolicy {
  return {
    network: {
      ...DEFAULT_POLICY.network,
      ...defaults.network,
      allowedHosts: [...(defaults.network?.allowedHosts ?? DEFAULT_POLICY.network.allowedHosts)],
    },
    filesystem: {
      ...DEFAULT_POLICY.filesystem,
      ...defaults.filesystem,
      readRoots: [...(defaults.filesystem?.readRoots ?? DEFAULT_POLICY.filesystem.readRoots)],
      writeRoots: [...(defaults.filesystem?.writeRoots ?? DEFAULT_POLICY.filesystem.writeRoots)],
    },
    execution: {
      ...DEFAULT_POLICY.execution,
      ...defaults.execution,
    },
    secrets: {
      ...DEFAULT_POLICY.secrets,
      ...defaults.secrets,
      allowedSecretRefs: [...(defaults.secrets?.allowedSecretRefs ?? DEFAULT_POLICY.secrets.allowedSecretRefs)],
    },
    preview: {
      ...DEFAULT_POLICY.preview,
      ...defaults.preview,
    },
    extensions: undefined,
  };
}

function applyRequest(defaults: EffectivePolicy, request: PolicyRequest): EffectivePolicy {
  return {
    network: {
      ...defaults.network,
      ...request.network,
      allowedHosts: [...(request.network?.allowedHosts ?? defaults.network.allowedHosts)],
    },
    filesystem: {
      ...defaults.filesystem,
      ...request.filesystem,
      readRoots: [...(request.filesystem?.readRoots ?? defaults.filesystem.readRoots)],
      writeRoots: [...(request.filesystem?.writeRoots ?? defaults.filesystem.writeRoots)],
    },
    execution: {
      ...defaults.execution,
      ...request.execution,
    },
    secrets: {
      ...defaults.secrets,
      ...request.secrets,
      allowedSecretRefs: [...(request.secrets?.allowedSecretRefs ?? defaults.secrets.allowedSecretRefs)],
    },
    preview: {
      ...defaults.preview,
      ...request.preview,
      mode: request.preview?.mode ?? defaults.preview.mode,
    },
    extensions: request.extensions ? { ...request.extensions } : undefined,
  };
}
