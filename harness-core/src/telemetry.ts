import {
  context,
  trace,
  SpanStatusCode,
  type Attributes,
  type Span,
  type SpanOptions,
} from '@opentelemetry/api';

export const HARNESS_OTEL_TRACER_NAME = 'agent-harness';
export const HARNESS_OTEL_TRACER_VERSION = '0.1.0';

export interface HarnessTelemetrySpanOptions extends SpanOptions {
  attributes?: Attributes;
}

export async function withHarnessTelemetrySpan<T>(
  name: string,
  options: HarnessTelemetrySpanOptions,
  run: (span: Span) => Promise<T> | T,
): Promise<T> {
  const tracer = trace.getTracer(HARNESS_OTEL_TRACER_NAME, HARNESS_OTEL_TRACER_VERSION);
  const span = tracer.startSpan(name, options);
  const activeContext = trace.setSpan(context.active(), span);

  return context.with(activeContext, async () => {
    try {
      const result = await run(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (caught) {
      const error = toHarnessTelemetryError(caught);
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw caught;
    } finally {
      span.end();
    }
  });
}

export function setHarnessTelemetryAttributes(span: Span, attributes: Attributes): void {
  span.setAttributes(attributes);
}

export function toHarnessTelemetryError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}
