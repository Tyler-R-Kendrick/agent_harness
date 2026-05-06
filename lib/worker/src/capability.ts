import { capabilityId, type CapabilityId } from './ids';

export interface Capability {
  id: CapabilityId;
  version?: string;
  attributes?: Record<string, unknown>;
}

export interface CapabilitySet {
  has(id: CapabilityId): boolean;
  get(id: CapabilityId): Capability | undefined;
  list(): Capability[];
}

export interface CapabilityRequirement {
  id: CapabilityId;
  optional?: boolean;
  constraints?: Record<string, unknown>;
}

export interface CapabilityMatchResult {
  ok: boolean;
  missing: CapabilityRequirement[];
  failed: Array<{
    requirement: CapabilityRequirement;
    reason: string;
  }>;
}

export interface CapabilityMatcher {
  satisfies(available: CapabilitySet, requirements: CapabilityRequirement[]): CapabilityMatchResult;
}

export class DefaultCapabilitySet implements CapabilitySet {
  private readonly capabilities = new Map<CapabilityId, Capability>();

  constructor(capabilities: Capability[] = []) {
    for (const capability of capabilities) {
      this.capabilities.set(capability.id, cloneCapability(capability));
    }
  }

  has(id: CapabilityId): boolean {
    return this.capabilities.has(id);
  }

  get(id: CapabilityId): Capability | undefined {
    const capability = this.capabilities.get(id);
    return capability ? cloneCapability(capability) : undefined;
  }

  list(): Capability[] {
    return [...this.capabilities.values()].map(cloneCapability);
  }
}

export class DefaultCapabilityMatcher implements CapabilityMatcher {
  satisfies(available: CapabilitySet, requirements: CapabilityRequirement[] = []): CapabilityMatchResult {
    const missing: CapabilityRequirement[] = [];
    const failed: CapabilityMatchResult['failed'] = [];

    for (const requirement of requirements) {
      const capability = available.get(requirement.id);
      if (!capability) {
        if (!requirement.optional) {
          missing.push(requirement);
        }
        continue;
      }

      const failure = checkConstraints(capability, requirement);
      if (failure) {
        failed.push({ requirement, reason: failure });
      }
    }

    return {
      ok: missing.length === 0 && failed.length === 0,
      missing,
      failed,
    };
  }
}

function cloneCapability(capability: Capability): Capability {
  return {
    ...capability,
    attributes: capability.attributes ? { ...capability.attributes } : undefined,
  };
}

function checkConstraints(capability: Capability, requirement: CapabilityRequirement): string | null {
  if (!requirement.constraints) {
    return null;
  }
  const attributes = capability.attributes ?? {};
  for (const [key, expected] of Object.entries(requirement.constraints)) {
    const actual = attributes[key];
    if (!Object.is(actual, expected)) {
      return `Capability ${capability.id} attribute ${key} expected ${String(expected)} but got ${String(actual)}.`;
    }
  }
  return null;
}

export const CapExecJavaScript = capabilityId('cap.exec.javascript');
export const CapExecPython = capabilityId('cap.exec.python');
export const CapExecShell = capabilityId('cap.exec.shell');
export const CapFsVirtual = capabilityId('cap.fs.virtual');
export const CapFsWorkspaceScoped = capabilityId('cap.fs.workspace-scoped');
export const CapNetworkEgress = capabilityId('cap.network.egress');
export const CapPreviewHtml = capabilityId('cap.preview.html');
export const CapPreviewPort = capabilityId('cap.preview.port');
export const CapPackagesNpm = capabilityId('cap.packages.npm');
export const CapProcessNative = capabilityId('cap.process.native');
export const CapLifecycleLongRunning = capabilityId('cap.lifecycle.long-running');
export const CapPersistenceEphemeral = capabilityId('cap.persistence.ephemeral');
export const CapPersistenceDurable = capabilityId('cap.persistence.durable');
export const CapIsolationWasm = capabilityId('cap.isolation.wasm');
export const CapIsolationContainer = capabilityId('cap.isolation.container');
export const CapIsolationMicrovm = capabilityId('cap.isolation.microvm');
