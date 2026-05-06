import type { SandboxBroker } from './sandbox';
import type { WorkerProvider } from './worker';
import type { SandboxProvider } from './sandbox';
import type { PolicyEngine } from './policy';
import type { CapabilitySet } from './capability';
import type { ProviderId } from './ids';

export interface ProviderRef {
  id: ProviderId;
}

export interface ProviderSurface {
  id: string;
  version?: string;
}

export interface ProviderDescriptor {
  ref: ProviderRef;
  displayName?: string;
  version?: string;
  provides: ProviderSurface[];
  capabilities?: CapabilitySet;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface Provider {
  readonly ref: ProviderRef;
  describe(): Promise<ProviderDescriptor>;
}

export interface Logger {
  debug?(message: string, metadata?: Record<string, unknown>): void;
  info?(message: string, metadata?: Record<string, unknown>): void;
  warn?(message: string, metadata?: Record<string, unknown>): void;
  error?(message: string, metadata?: Record<string, unknown>): void;
}

export interface Clock {
  now(): Date;
}

export interface SubjectRef {
  id: string;
  labels?: Record<string, string>;
}

export interface ProjectRef {
  id: string;
  labels?: Record<string, string>;
}

export interface ProviderContext {
  registry: ProviderRegistry;
  sandboxBroker: SandboxBroker;
  policyEngine: PolicyEngine;
  logger?: Logger;
  clock?: Clock;
  signal?: AbortSignal;
  subject?: SubjectRef;
  project?: ProjectRef;
  extensions?: Record<string, unknown>;
}

export interface ProviderRegistry {
  register(provider: Provider): void;
  unregister(providerId: ProviderId): void;
  get(providerId: ProviderId): Provider | undefined;
  list(): Provider[];
  listDescriptors(): Promise<ProviderDescriptor[]>;
  getWorkerProviders(): WorkerProvider[];
  getSandboxProviders(): SandboxProvider[];
}

export const SurfaceWorkerProvider = 'surface.worker-provider';
export const SurfaceSandboxProvider = 'surface.sandbox-provider';
export const SurfaceWorkerAdapter = 'surface.worker-adapter';
export const SurfaceSandboxAdapter = 'surface.sandbox-adapter';

export const WorkerProviderMarker = Symbol.for('@agent-harness/worker/WorkerProvider');
export const SandboxProviderMarker = Symbol.for('@agent-harness/worker/SandboxProvider');

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<ProviderId, Provider>();

  register(provider: Provider): void {
    this.providers.set(provider.ref.id, provider);
  }

  unregister(providerId: ProviderId): void {
    this.providers.delete(providerId);
  }

  get(providerId: ProviderId): Provider | undefined {
    return this.providers.get(providerId);
  }

  list(): Provider[] {
    return [...this.providers.values()];
  }

  async listDescriptors(): Promise<ProviderDescriptor[]> {
    return Promise.all(this.list().map((provider) => provider.describe()));
  }

  getWorkerProviders(): WorkerProvider[] {
    return this.list().filter(isWorkerProvider);
  }

  getSandboxProviders(): SandboxProvider[] {
    return this.list().filter(isSandboxProvider);
  }
}

export function isWorkerProvider(provider: Provider): provider is WorkerProvider {
  const candidate = provider as Provider & {
    [WorkerProviderMarker]?: boolean;
    listWorkers?: unknown;
    createWorker?: unknown;
    connectWorker?: unknown;
  };
  return Boolean(candidate[WorkerProviderMarker])
    || typeof candidate.listWorkers === 'function'
    || typeof candidate.createWorker === 'function'
    || typeof candidate.connectWorker === 'function';
}

export function isSandboxProvider(provider: Provider): provider is SandboxProvider {
  const candidate = provider as Provider & {
    [SandboxProviderMarker]?: boolean;
    listSandboxes?: unknown;
    createSandbox?: unknown;
    connectSandbox?: unknown;
  };
  return Boolean(candidate[SandboxProviderMarker])
    || typeof candidate.listSandboxes === 'function'
    || typeof candidate.createSandbox === 'function'
    || typeof candidate.connectSandbox === 'function';
}
