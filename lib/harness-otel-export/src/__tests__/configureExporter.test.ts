import { afterEach, describe, expect, it, vi } from 'vitest';
import { trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  configureHarnessTelemetryExporter,
  createInMemorySpanExporter,
} from '../index';

afterEach(() => {
  // Restore the global no-op tracer between tests so global state never leaks.
  trace.disable();
});

describe('configureHarnessTelemetryExporter', () => {
  it('registers nothing by default (shadow mode) with no options', async () => {
    const handle = configureHarnessTelemetryExporter();

    expect(handle.enabled).toBe(false);
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it('does not register when kind is "off", even with injected seams', async () => {
    const register = vi.fn();
    const providerFactory = vi.fn();
    const disable = vi.fn();

    const handle = configureHarnessTelemetryExporter({
      exporter: 'off',
      register,
      providerFactory,
      disable,
    });

    expect(handle.enabled).toBe(false);
    expect(register).not.toHaveBeenCalled();
    expect(providerFactory).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
    await expect(handle.shutdown()).resolves.toBeUndefined();
  });

  it('registers a ConsoleSpanExporter provider for kind "console"', async () => {
    const handle = configureHarnessTelemetryExporter({ exporter: 'console' });

    expect(handle.enabled).toBe(true);
    await handle.shutdown();
  });

  it('registers an InMemorySpanExporter provider for kind "inmemory"', async () => {
    const handle = configureHarnessTelemetryExporter({ exporter: 'inmemory' });

    expect(handle.enabled).toBe(true);
    await handle.shutdown();
  });

  it('registers a real BasicTracerProvider end-to-end and captures spans', async () => {
    const memoryExporter = createInMemorySpanExporter();

    // No `exporter` kind → defaults to 'off', but the custom spanExporter
    // overrides that default and enables export.
    const handle = configureHarnessTelemetryExporter({ spanExporter: memoryExporter });
    expect(handle.enabled).toBe(true);

    const tracer = trace.getTracer('harness-otel-export-test');
    const span = tracer.startSpan('e2e.span');
    span.end();

    expect(memoryExporter.getFinishedSpans().map((finished) => finished.name)).toContain(
      'e2e.span',
    );

    await handle.shutdown();
  });

  it('honors a custom spanExporter even when the kind is "off"', () => {
    const memoryExporter = createInMemorySpanExporter();

    const handle = configureHarnessTelemetryExporter({
      exporter: 'off',
      spanExporter: memoryExporter,
    });

    expect(handle.enabled).toBe(true);
  });

  it('uses injected providerFactory/register/disable for the shutdown path', async () => {
    const providerShutdown = vi.fn(async () => {});
    const provider = { shutdown: providerShutdown };
    const providerFactory = vi.fn(() => provider);
    const register = vi.fn();
    const disable = vi.fn();
    const spanExporter = createInMemorySpanExporter();

    const handle = configureHarnessTelemetryExporter({
      exporter: 'inmemory',
      spanExporter,
      providerFactory,
      register,
      disable,
    });

    expect(handle.enabled).toBe(true);
    expect(providerFactory).toHaveBeenCalledWith(spanExporter);
    expect(register).toHaveBeenCalledWith(provider);
    expect(disable).not.toHaveBeenCalled();

    await handle.shutdown();

    expect(providerShutdown).toHaveBeenCalledTimes(1);
    expect(disable).toHaveBeenCalledTimes(1);
  });
});

describe('createInMemorySpanExporter', () => {
  it('returns a fresh InMemorySpanExporter with no finished spans', () => {
    const exporter = createInMemorySpanExporter();

    expect(exporter).toBeInstanceOf(InMemorySpanExporter);
    expect(exporter.getFinishedSpans()).toEqual([]);
  });
});
