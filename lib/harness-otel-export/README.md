# @agent-harness/harness-otel-export

OpenTelemetry SDK/exporter bootstrap for the `harness-core` telemetry surface.

`harness-core/src/telemetry.ts` (`withHarnessTelemetrySpan`,
`HARNESS_OTEL_TRACER_NAME`) is **API-only** today: it creates spans against the
global OpenTelemetry tracer but never registers a `TracerProvider`, so every
span is a no-op. This package provides the missing SDK/exporter bootstrap
without changing that default behavior.

This is Phase 0 (shadow mode) of the observability rollout described in
[`docs/adr/2026-07-02-observability-and-traces.md`](../../docs/adr/2026-07-02-observability-and-traces.md).

## Default off = shadow mode, zero behavior change

`configureHarnessTelemetryExporter({ exporter: 'off' })` — which is the default —
registers **nothing**. No global `TracerProvider` is installed, so
`harness-core` spans stay exactly as no-op as they are today. There is no
behavior change until export is explicitly enabled.

A global `TracerProvider` is registered **only** when you explicitly ask for an
exporter, either a built-in kind (`'console'` / `'inmemory'`) or your own
`spanExporter`. In production, consumers supply their own OTLP exporter (for
example `@opentelemetry/exporter-trace-otlp-http`) via `spanExporter` — this
package intentionally does not depend on any OTLP transport.

## API

```ts
import {
  configureHarnessTelemetryExporter,
  createInMemorySpanExporter,
  type ConfigureHarnessTelemetryExporterOptions,
  type HarnessTelemetryExporterHandle,
  type HarnessTelemetryExporterKind,
} from '@agent-harness/harness-otel-export';
```

### `configureHarnessTelemetryExporter(options?)`

```ts
type HarnessTelemetryExporterKind = 'off' | 'console' | 'inmemory';

interface ConfigureHarnessTelemetryExporterOptions {
  exporter?: HarnessTelemetryExporterKind;        // default 'off'
  spanExporter?: SpanExporter;                     // custom exporter; overrides kind
  // injectable seams (primarily for tests):
  providerFactory?: (spanExporter: SpanExporter) => { shutdown(): Promise<void> };
  register?: (provider: unknown) => void;          // default: trace.setGlobalTracerProvider
  disable?: () => void;                            // default: trace.disable
}

interface HarnessTelemetryExporterHandle {
  enabled: boolean;
  shutdown: () => Promise<void>;
}
```

Behavior:

- Resolve the kind (default `'off'`). If the kind is `'off'` **and** no
  `spanExporter` is supplied, register nothing and return
  `{ enabled: false, shutdown: async () => {} }`.
- Otherwise pick the exporter: the custom `spanExporter` if given, else a
  `ConsoleSpanExporter` for `'console'`, else an `InMemorySpanExporter` for
  `'inmemory'`. A custom `spanExporter` is honored even when the kind is
  `'off'` (`enabled` is then `true`).
- Build a provider (default:
  `new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] })`),
  register it (default `trace.setGlobalTracerProvider`), and return
  `{ enabled: true, shutdown }`. `shutdown()` flushes and shuts down the
  provider, then calls `disable()` (default `trace.disable`) to restore the
  global no-op tracer.

### `createInMemorySpanExporter()`

Re-exports a fresh `InMemorySpanExporter` so consumers and tests can capture
finished spans (`exporter.getFinishedSpans()`).

## Examples

Shadow mode (the default — nothing is registered):

```ts
const handle = configureHarnessTelemetryExporter();
handle.enabled; // false
```

Enable an OTLP exporter you supply:

```ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const handle = configureHarnessTelemetryExporter({
  spanExporter: new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }),
});
// ... run instrumented harness work ...
await handle.shutdown();
```

Capture spans in tests:

```ts
const memoryExporter = createInMemorySpanExporter();
const handle = configureHarnessTelemetryExporter({ spanExporter: memoryExporter });
// ... exercise harness-core telemetry ...
const spans = memoryExporter.getFinishedSpans();
await handle.shutdown();
```

## Local development

```sh
npm run test
npm run test:coverage
```
