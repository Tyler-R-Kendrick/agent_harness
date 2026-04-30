import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BROWSER_LOCATION_CONTEXT,
  buildBrowserLocationPromptContext,
  createBrowserLocationApi,
  isBrowserLocationContext,
  requestBrowserLocationContext,
} from './browserLocation';

describe('browserLocation', () => {
  it('requests, rounds, validates, and formats opt-in browser location context', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 41.878113,
          longitude: -87.629799,
          accuracy: 24.6,
        },
        timestamp: Date.parse('2026-04-29T19:00:00.000Z'),
      } as GeolocationPosition);
    });
    const api = createBrowserLocationApi({ getCurrentPosition } as unknown as Geolocation);

    const result = await requestBrowserLocationContext(api);

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('granted');
    expect(result.context).toEqual({
      enabled: true,
      latitude: 41.88,
      longitude: -87.63,
      accuracyMeters: 25,
      capturedAt: '2026-04-29T19:00:00.000Z',
    });
    expect(isBrowserLocationContext(result.context)).toBe(true);
    expect(buildBrowserLocationPromptContext(result.context)).toContain('Approximate coordinates: 41.88, -87.63');
    expect(buildBrowserLocationPromptContext(result.context)).toContain('Accuracy: about 25m');
    expect(buildBrowserLocationPromptContext(DEFAULT_BROWSER_LOCATION_CONTEXT)).toBeNull();
  });

  it('returns unsupported or denied results without enabling prompt context', async () => {
    await expect(requestBrowserLocationContext(null)).resolves.toEqual({
      status: 'unsupported',
      context: DEFAULT_BROWSER_LOCATION_CONTEXT,
    });

    const deniedApi = createBrowserLocationApi({
      getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback | null | undefined) => {
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      },
    } as unknown as Geolocation);

    await expect(requestBrowserLocationContext(deniedApi)).resolves.toEqual({
      status: 'denied',
      context: DEFAULT_BROWSER_LOCATION_CONTEXT,
    });
  });

  it('rejects malformed stored contexts', () => {
    expect(isBrowserLocationContext({ enabled: true, latitude: 200, longitude: 0 })).toBe(false);
    expect(isBrowserLocationContext({ enabled: true, latitude: 41.88, longitude: -87.63, capturedAt: 'bad-date' })).toBe(false);
    expect(isBrowserLocationContext({ enabled: false })).toBe(true);
  });
});
