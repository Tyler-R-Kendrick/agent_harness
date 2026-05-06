import type { CapabilityMatcher, CapabilityRequirement, CapabilitySet } from './capability';
import type { EffectivePolicy, PolicyRequest, PolicyEngine } from './policy';
import type { Provider, ProviderContext, ProviderRef, ProviderRegistry } from './provider';
import type { SandboxTypeId } from './ids';

export interface SandboxRef {
  id: string;
  type: SandboxTypeId;
}

export interface SandboxDescriptor {
  ref: SandboxRef;
  provider: ProviderRef;
  displayName?: string;
  capabilities: CapabilitySet;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface SandboxExecuteRequest {
  command: string;
  timeoutMs?: number;
  input?: Uint8Array;
  env?: Record<string, string>;
  cwd?: string;
  annotations?: Record<string, unknown>;
}

export interface SandboxExecuteResult {
  output: string;
  stdout?: string;
  stderr?: string;
  exitCode: number | null;
  truncated: boolean;
  durationMs: number;
  annotations?: Record<string, unknown>;
}

export interface SandboxFile {
  path: string;
  content: Uint8Array;
}

export interface SandboxFileResult {
  path: string;
  error: string | null;
}

export interface SandboxDownloadedFile {
  path: string;
  content: Uint8Array | null;
  error: string | null;
}

export interface SandboxUploadRequest {
  files: SandboxFile[];
}

export interface SandboxUploadResult {
  files: SandboxFileResult[];
}

export interface SandboxDownloadRequest {
  paths: string[];
}

export interface SandboxDownloadResult {
  files: SandboxDownloadedFile[];
}

export interface Sandbox {
  readonly ref: SandboxRef;
  readonly provider: ProviderRef;
  describe(): Promise<SandboxDescriptor>;
  execute(request: SandboxExecuteRequest): Promise<SandboxExecuteResult>;
  uploadFiles?(request: SandboxUploadRequest): Promise<SandboxUploadResult>;
  downloadFiles?(request: SandboxDownloadRequest): Promise<SandboxDownloadResult>;
  reset?(): Promise<void>;
  close?(): Promise<void>;
}

export interface SandboxQuery {
  type?: SandboxTypeId;
  requiredCapabilities?: CapabilityRequirement[];
  labels?: Record<string, string>;
}

export interface CreateSandboxRequest {
  type?: SandboxTypeId;
  requiredCapabilities?: CapabilityRequirement[];
  policy?: PolicyRequest;
  effectivePolicy?: EffectivePolicy;
  labels?: Record<string, string>;
  annotations?: Record<string, unknown>;
}

export interface SandboxProvider extends Provider {
  listSandboxes?(query?: SandboxQuery): Promise<SandboxDescriptor[]>;
  createSandbox(request: CreateSandboxRequest, context: ProviderContext): Promise<Sandbox>;
  connectSandbox?(ref: SandboxRef, context: ProviderContext): Promise<Sandbox>;
}

export interface SandboxLease {
  sandbox: Sandbox;
  policy: EffectivePolicy;
  expiresAt?: string;
  release(): Promise<void>;
}

export interface SandboxBroker {
  createSandbox(request: CreateSandboxRequest, context?: Partial<ProviderContext>): Promise<SandboxLease>;
  connectSandbox(ref: SandboxRef, context?: Partial<ProviderContext>): Promise<SandboxLease>;
}

export interface SandboxResolver {
  resolve(request: CreateSandboxRequest, candidates: SandboxProvider[], context: ProviderContext): Promise<SandboxProvider>;
}

export class DefaultSandboxResolver implements SandboxResolver {
  constructor(private readonly capabilityMatcher: CapabilityMatcher) {}

  async resolve(request: CreateSandboxRequest, candidates: SandboxProvider[], context: ProviderContext): Promise<SandboxProvider> {
    const matches: Array<{ provider: SandboxProvider; score: number }> = [];
    const diagnostics: string[] = [];

    for (const provider of candidates) {
      const descriptors = await getSandboxDescriptors(provider, request);
      if (descriptors.length === 0) {
        diagnostics.push(`${provider.ref.id}: no sandbox descriptors available.`);
        continue;
      }
      const descriptorMatches = descriptors.map((descriptor) => scoreSandboxDescriptor(descriptor, request, this.capabilityMatcher));
      const best = descriptorMatches.sort((left, right) => right.score - left.score)[0];
      if (best.ok) {
        matches.push({ provider, score: best.score });
      } else {
        diagnostics.push(`${provider.ref.id}: ${best.reason}.`);
      }
    }

    const selected = matches.sort((left, right) => right.score - left.score)[0];
    if (selected) {
      return selected.provider;
    }

    context.logger?.debug?.('Sandbox provider resolution failed.', { diagnostics });
    throw new Error(`No sandbox provider matched request. ${diagnostics.join(' ')}`.trim());
  }
}

export interface DefaultSandboxBrokerOptions {
  registry: ProviderRegistry;
  resolver: SandboxResolver;
  policyEngine: PolicyEngine;
  context?: Partial<ProviderContext>;
}

export class DefaultSandboxBroker implements SandboxBroker {
  private readonly registry: ProviderRegistry;
  private readonly resolver: SandboxResolver;
  private readonly policyEngine: PolicyEngine;
  private readonly context: Partial<ProviderContext>;

  constructor(options: DefaultSandboxBrokerOptions) {
    this.registry = options.registry;
    this.resolver = options.resolver;
    this.policyEngine = options.policyEngine;
    this.context = options.context ?? {};
  }

  async createSandbox(request: CreateSandboxRequest, context: Partial<ProviderContext> = {}): Promise<SandboxLease> {
    const providerContext = this.createContext(context);
    const provider = await this.resolver.resolve(request, this.registry.getSandboxProviders(), providerContext);
    const decision = await this.policyEngine.evaluate({
      requestedPolicy: request.policy,
      subject: providerContext.subject,
      project: providerContext.project,
    });
    if (!decision.allowed || !decision.effectivePolicy) {
      throw new Error(`Sandbox creation denied. ${decision.reasons.join(' ')}`.trim());
    }

    const sandbox = await provider.createSandbox({ ...request, effectivePolicy: decision.effectivePolicy }, providerContext);
    return {
      sandbox,
      policy: decision.effectivePolicy,
      release: async () => {
        await sandbox.close?.();
      },
    };
  }

  async connectSandbox(ref: SandboxRef, context: Partial<ProviderContext> = {}): Promise<SandboxLease> {
    const providerContext = this.createContext(context);
    const provider = await this.findSandboxProvider(ref, providerContext);
    const decision = await this.policyEngine.evaluate({
      subject: providerContext.subject,
      project: providerContext.project,
    });
    if (!decision.allowed || !decision.effectivePolicy) {
      throw new Error(`Sandbox connection denied. ${decision.reasons.join(' ')}`.trim());
    }
    const sandbox = await provider.connectSandbox!(ref, providerContext);
    return {
      sandbox,
      policy: decision.effectivePolicy,
      release: async () => {
        await sandbox.close?.();
      },
    };
  }

  private createContext(context: Partial<ProviderContext>): ProviderContext {
    return {
      ...this.context,
      ...context,
      registry: this.registry,
      sandboxBroker: this,
      policyEngine: this.policyEngine,
    };
  }

  private async findSandboxProvider(ref: SandboxRef, context: ProviderContext): Promise<SandboxProvider> {
    for (const provider of this.registry.getSandboxProviders()) {
      if (!provider.connectSandbox) {
        continue;
      }
      const descriptors = await getSandboxDescriptors(provider, { type: ref.type });
      if (descriptors.some((descriptor) => descriptor.ref.id === ref.id || descriptor.ref.type === ref.type)) {
        return provider;
      }
    }
    context.logger?.debug?.('Sandbox connect provider not found.', { ref });
    throw new Error(`No sandbox provider can connect to sandbox ${ref.id}.`);
  }
}

async function getSandboxDescriptors(provider: SandboxProvider, request: CreateSandboxRequest): Promise<SandboxDescriptor[]> {
  if (provider.listSandboxes) {
    return provider.listSandboxes({
      type: request.type,
      requiredCapabilities: request.requiredCapabilities,
      labels: request.labels,
    });
  }
  const descriptor = await provider.describe();
  return descriptor.capabilities
    ? [{
      ref: { id: `${provider.ref.id}:sandbox`, type: request.type ?? ('' as SandboxTypeId) },
      provider: provider.ref,
      capabilities: descriptor.capabilities,
      displayName: descriptor.displayName,
      labels: descriptor.labels,
      annotations: descriptor.annotations,
    }]
    : [];
}

function scoreSandboxDescriptor(
  descriptor: SandboxDescriptor,
  request: CreateSandboxRequest,
  capabilityMatcher: CapabilityMatcher,
): { ok: boolean; score: number; reason?: string } {
  if (request.type && descriptor.ref.type !== request.type) {
    return { ok: false, score: 0, reason: `sandbox type ${descriptor.ref.type} did not match ${request.type}` };
  }
  const requirements = request.requiredCapabilities ?? [];
  const match = capabilityMatcher.satisfies(descriptor.capabilities, requirements);
  if (!match.ok) {
    return {
      ok: false,
      score: 0,
      reason: [
        ...match.missing.map((requirement) => `missing ${requirement.id}`),
        ...match.failed.map((failure) => failure.reason),
      ].join('; '),
    };
  }
  const requiredScore = requirements.filter((requirement) => descriptor.capabilities.has(requirement.id)).length * 10;
  return {
    ok: true,
    score: requiredScore + descriptor.capabilities.list().length,
  };
}
