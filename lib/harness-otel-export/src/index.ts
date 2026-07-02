export {
  configureHarnessTelemetryExporter,
  createInMemorySpanExporter,
} from './configureExporter';
export type {
  ConfigureHarnessTelemetryExporterOptions,
  HarnessTelemetryExporterHandle,
  HarnessTelemetryExporterKind,
  HarnessTelemetryProviderLike,
} from './configureExporter';
export { InMemorySpanExporter, type SpanExporter } from '@opentelemetry/sdk-trace-base';
