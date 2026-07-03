import { trace, type TracerProvider } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  ConsoleSpanExporter,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';

/**
 * Which built-in exporter to register when telemetry export is enabled.
 *
 * - `'off'` (default): register nothing. Spans stay no-op, exactly as they are
 *   today when `harness-core/src/telemetry.ts` runs without a TracerProvider.
 * - `'console'`: register a {@link ConsoleSpanExporter} (diagnostics only).
 * - `'inmemory'`: register an {@link InMemorySpanExporter} (tests/capture).
 */
export type HarnessTelemetryExporterKind = 'off' | 'console' | 'inmemory';

/**
 * The minimal shape this bootstrap needs from a TracerProvider: it must be
 * shutdownable so {@link HarnessTelemetryExporterHandle.shutdown} can flush and
 * restore the global no-op tracer.
 */
export interface HarnessTelemetryProviderLike {
  shutdown(): Promise<void>;
}

export interface ConfigureHarnessTelemetryExporterOptions {
  /** Which built-in exporter to register. Defaults to `'off'` (shadow mode). */
  exporter?: HarnessTelemetryExporterKind;
  /**
   * A custom {@link SpanExporter} (e.g. an OTLP exporter the caller supplies).
   * When provided it overrides the built-in {@link exporter} kind, so callers
   * can enable export even while leaving the kind at its `'off'` default.
   */
  spanExporter?: SpanExporter;
  /** Injectable seam: build the provider from the resolved span exporter. */
  providerFactory?: (spanExporter: SpanExporter) => HarnessTelemetryProviderLike;
  /** Injectable seam: register the provider. Defaults to `trace.setGlobalTracerProvider`. */
  register?: (provider: unknown) => void;
  /** Injectable seam: restore no-op tracing on shutdown. Defaults to `trace.disable`. */
  disable?: () => void;
}

export interface HarnessTelemetryExporterHandle {
  /** `true` when a provider was registered; `false` in shadow mode. */
  enabled: boolean;
  /** Flush and shut down the provider, then restore the global no-op tracer. */
  shutdown: () => Promise<void>;
}

function defaultProviderFactory(spanExporter: SpanExporter): HarnessTelemetryProviderLike {
  return new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spanExporter)],
  });
}

function defaultRegister(provider: unknown): void {
  trace.setGlobalTracerProvider(provider as TracerProvider);
}

function defaultDisable(): void {
  trace.disable();
}

function resolveSpanExporter(
  kind: HarnessTelemetryExporterKind,
  custom: SpanExporter | undefined,
): SpanExporter | undefined {
  if (custom) {
    return custom;
  }
  if (kind === 'console') {
    return new ConsoleSpanExporter();
  }
  if (kind === 'inmemory') {
    return new InMemorySpanExporter();
  }
  return undefined;
}

/**
 * Bootstrap the OpenTelemetry SDK/exporter that `harness-core` telemetry
 * (API-only today) otherwise lacks.
 *
 * Shadow mode is the default: with `{ exporter: 'off' }` (or no options) this
 * registers **nothing**, so spans remain no-op and there is zero behavior
 * change. A global TracerProvider is only registered when an exporter is
 * explicitly requested — via the built-in {@link HarnessTelemetryExporterKind}
 * or a custom {@link ConfigureHarnessTelemetryExporterOptions.spanExporter}.
 */
export function configureHarnessTelemetryExporter(
  options: ConfigureHarnessTelemetryExporterOptions = {},
): HarnessTelemetryExporterHandle {
  const kind = options.exporter ?? 'off';
  const spanExporter = resolveSpanExporter(kind, options.spanExporter);

  if (!spanExporter) {
    return { enabled: false, shutdown: async () => {} };
  }

  const providerFactory = options.providerFactory ?? defaultProviderFactory;
  const register = options.register ?? defaultRegister;
  const disable = options.disable ?? defaultDisable;

  const provider = providerFactory(spanExporter);
  register(provider);

  return {
    enabled: true,
    shutdown: async () => {
      await provider.shutdown();
      disable();
    },
  };
}

/**
 * Re-export helper so consumers/tests can capture finished spans without a
 * deep import into `@opentelemetry/sdk-trace-base`.
 */
export function createInMemorySpanExporter(): InMemorySpanExporter {
  return new InMemorySpanExporter();
}
