export type BrowserLocationContext = {
  enabled: boolean;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  capturedAt?: string;
};

export type BrowserLocationRequestStatus = 'granted' | 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'error';

export type BrowserLocationRequestResult = {
  status: BrowserLocationRequestStatus;
  context: BrowserLocationContext;
};

export type BrowserLocationApi = {
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ) => void;
};

export const DEFAULT_BROWSER_LOCATION_CONTEXT: BrowserLocationContext = {
  enabled: false,
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 300_000,
  timeout: 10_000,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidLatitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return isFiniteNumber(value) && value >= -180 && value <= 180;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function toGeolocationStatus(error: GeolocationPositionError): BrowserLocationRequestStatus {
  switch (error.code) {
    case 1:
      return 'denied';
    case 2:
      return 'unavailable';
    case 3:
      return 'timeout';
    default:
      return 'error';
  }
}

export function isBrowserLocationContext(value: unknown): value is BrowserLocationContext {
  if (!isRecord(value) || typeof value.enabled !== 'boolean') return false;
  if (value.enabled === false) {
    return (
      (value.latitude === undefined || isValidLatitude(value.latitude))
      && (value.longitude === undefined || isValidLongitude(value.longitude))
      && (value.accuracyMeters === undefined || (isFiniteNumber(value.accuracyMeters) && value.accuracyMeters >= 0))
      && (value.capturedAt === undefined || isValidIsoDate(value.capturedAt))
    );
  }

  return (
    isValidLatitude(value.latitude)
    && isValidLongitude(value.longitude)
    && (value.accuracyMeters === undefined || (isFiniteNumber(value.accuracyMeters) && value.accuracyMeters >= 0))
    && isValidIsoDate(value.capturedAt)
  );
}

export function createBrowserLocationApi(geolocation: Geolocation | null | undefined): BrowserLocationApi | null {
  if (!geolocation) return null;
  return {
    getCurrentPosition: (success, error, options) => {
      geolocation.getCurrentPosition(success, error, options);
    },
  };
}

export async function requestBrowserLocationContext(
  api: BrowserLocationApi | null | undefined,
): Promise<BrowserLocationRequestResult> {
  if (!api) {
    return { status: 'unsupported', context: DEFAULT_BROWSER_LOCATION_CONTEXT };
  }

  return new Promise((resolve) => {
    try {
      api.getCurrentPosition(
        (position) => {
          resolve({
            status: 'granted',
            context: {
              enabled: true,
              latitude: roundCoordinate(position.coords.latitude),
              longitude: roundCoordinate(position.coords.longitude),
              accuracyMeters: Math.round(position.coords.accuracy),
              capturedAt: new Date(position.timestamp).toISOString(),
            },
          });
        },
        (error) => {
          resolve({ status: toGeolocationStatus(error), context: DEFAULT_BROWSER_LOCATION_CONTEXT });
        },
        GEOLOCATION_OPTIONS,
      );
    } catch {
      resolve({ status: 'error', context: DEFAULT_BROWSER_LOCATION_CONTEXT });
    }
  });
}

export function buildBrowserLocationPromptContext(context: BrowserLocationContext): string | null {
  if (!context.enabled || !isBrowserLocationContext(context)) return null;

  return [
    'Browser location context:',
    `- Approximate coordinates: ${context.latitude?.toFixed(2)}, ${context.longitude?.toFixed(2)}`,
    context.accuracyMeters !== undefined ? `- Accuracy: about ${context.accuracyMeters}m` : null,
    `- Captured: ${context.capturedAt}`,
    '',
    'Use this as approximate session context when location is relevant. Do not assume it is exact.',
  ].filter((line): line is string => line !== null).join('\n');
}
