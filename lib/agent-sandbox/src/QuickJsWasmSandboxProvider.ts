import {
  CapExecJavaScript,
  CapFsVirtual,
  CapIsolationWasm,
  CapPersistenceEphemeral,
  CapPreviewHtml,
  DefaultCapabilitySet,
  SandboxProviderMarker,
  SurfaceSandboxProvider,
  providerId,
  sandboxTypeId,
  type CapabilitySet,
  type CreateSandboxRequest,
  type ProviderContext,
  type ProviderDescriptor,
  type ProviderRef,
  type Sandbox,
  type SandboxDescriptor,
  type SandboxDownloadRequest,
  type SandboxDownloadResult,
  type SandboxExecuteRequest,
  type SandboxExecuteResult,
  type SandboxProvider,
  type SandboxRef,
  type SandboxUploadRequest,
  type SandboxUploadResult,
} from '@agent-harness/worker';
import {
  BrowserSandboxProvider,
  DEFAULT_MAX_OUTPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
} from './BrowserSandboxProvider';
import type { BrowserSandboxOptions } from './types';

export const QuickJsWasmSandboxProviderId = providerId('com.example.sandbox-provider.quickjs-wasm');
export const QuickJsWasmSandboxType = sandboxTypeId('com.example.sandbox.quickjs-wasm');

export interface QuickJsWasmSandboxProviderOptions extends BrowserSandboxOptions {
  providerId?: ProviderRef['id'];
  displayName?: string;
  capabilities?: CapabilitySet;
}

const DEFAULT_CAPABILITIES = new DefaultCapabilitySet([
  { id: CapExecJavaScript },
  { id: CapFsVirtual },
  { id: CapIsolationWasm },
  { id: CapPersistenceEphemeral },
  { id: CapPreviewHtml, attributes: { optional: true } },
]);

function cloneCapabilities(capabilities: CapabilitySet): DefaultCapabilitySet {
  return new DefaultCapabilitySet(capabilities.list());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class QuickJsWasmSandboxProvider implements SandboxProvider {
  readonly [SandboxProviderMarker] = true;
  readonly ref: ProviderRef;
  private readonly displayName: string;
  private readonly capabilities: CapabilitySet;
  private readonly options: BrowserSandboxOptions;

  constructor(options: QuickJsWasmSandboxProviderOptions = {}) {
    this.ref = { id: options.providerId ?? QuickJsWasmSandboxProviderId };
    this.displayName = options.displayName ?? 'Browser QuickJS WASM Sandbox Provider';
    this.capabilities = options.capabilities ?? DEFAULT_CAPABILITIES;
    this.options = { ...options };
  }

  async describe(): Promise<ProviderDescriptor> {
    return {
      ref: this.ref,
      displayName: this.displayName,
      provides: [{ id: SurfaceSandboxProvider }],
      capabilities: cloneCapabilities(this.capabilities),
      annotations: {
        security: 'Dedicated worker-backed QuickJS runtime with virtual filesystem and no network by default.',
      },
    };
  }

  async listSandboxes(): Promise<SandboxDescriptor[]> {
    return [this.createDescriptor(`${this.ref.id}:template`)];
  }

  async createSandbox(request: CreateSandboxRequest, _context: ProviderContext): Promise<Sandbox> {
    const effectivePolicy = request.effectivePolicy;
    const sandbox = new BrowserSandboxProvider({
      ...this.options,
      id: request.annotations?.id as string | undefined,
      defaultTimeoutMs: effectivePolicy?.execution.timeoutMs ?? this.options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxOutputBytes: effectivePolicy?.execution.maxOutputBytes ?? this.options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
      maxFileBytes: effectivePolicy?.filesystem.maxFileBytes ?? this.options.maxFileBytes,
      maxTotalBytes: effectivePolicy?.filesystem.maxTotalBytes ?? this.options.maxTotalBytes,
      allowNetwork: effectivePolicy ? effectivePolicy.network.mode !== 'none' : this.options.allowNetwork,
    });
    return new QuickJsWasmSandbox({
      ref: {
        id: sandbox.id,
        type: request.type ?? QuickJsWasmSandboxType,
      },
      provider: this.ref,
      capabilities: this.capabilities,
      sandbox,
    });
  }

  private createDescriptor(id: string): SandboxDescriptor {
    return {
      ref: { id, type: QuickJsWasmSandboxType },
      provider: this.ref,
      displayName: 'Browser QuickJS WASM Sandbox',
      capabilities: cloneCapabilities(this.capabilities),
      labels: {
        isolation: 'wasm',
        filesystem: 'virtual',
      },
    };
  }
}

export interface QuickJsWasmSandboxOptions {
  ref: SandboxRef;
  provider: ProviderRef;
  capabilities: CapabilitySet;
  sandbox: BrowserSandboxProvider;
}

export class QuickJsWasmSandbox implements Sandbox {
  readonly ref: SandboxRef;
  readonly provider: ProviderRef;
  private readonly capabilities: CapabilitySet;
  private readonly sandbox: BrowserSandboxProvider;

  constructor(options: QuickJsWasmSandboxOptions) {
    this.ref = options.ref;
    this.provider = options.provider;
    this.capabilities = options.capabilities;
    this.sandbox = options.sandbox;
  }

  async describe(): Promise<SandboxDescriptor> {
    return {
      ref: this.ref,
      provider: this.provider,
      displayName: 'Browser QuickJS WASM Sandbox',
      capabilities: cloneCapabilities(this.capabilities),
    };
  }

  async execute(request: SandboxExecuteRequest): Promise<SandboxExecuteResult> {
    try {
      const result = await this.sandbox.execute(request.command, { timeoutMs: request.timeoutMs });
      return {
        output: result.output,
        stdout: result.output,
        exitCode: result.exitCode,
        truncated: result.truncated,
        durationMs: result.durationMs,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      return {
        output: message,
        stderr: message,
        exitCode: null,
        truncated: false,
        durationMs: 0,
      };
    }
  }

  async uploadFiles(request: SandboxUploadRequest): Promise<SandboxUploadResult> {
    const files = await this.sandbox.uploadFiles(request.files.map((file) => [file.path, file.content]));
    return { files };
  }

  async downloadFiles(request: SandboxDownloadRequest): Promise<SandboxDownloadResult> {
    const files = await this.sandbox.downloadFiles(request.paths);
    return { files };
  }

  async reset(): Promise<void> {
    await this.sandbox.reset();
  }

  async close(): Promise<void> {
    await this.sandbox.close();
  }
}
