import { describe, expect, it } from 'vitest';

import { ConnectorError, failFromUnknown, failure, ok } from './types';

describe('extension result helpers', () => {
  it('creates sanitized success and failure results', () => {
    expect(ok({ ready: true })).toEqual({ ok: true, data: { ready: true } });
    expect(failure('Nope', 'INVALID_REQUEST')).toEqual({ ok: false, error: 'Nope', code: 'INVALID_REQUEST' });
    expect(failure('No code')).toEqual({ ok: false, error: 'No code' });
    expect(failFromUnknown(new ConnectorError('Bad endpoint', 'INVALID_BASE_URL', 400))).toEqual({
      ok: false,
      error: 'Bad endpoint',
      code: 'INVALID_BASE_URL',
      status: 400,
    });
    expect(failFromUnknown(new Error('hidden'))).toEqual({
      ok: false,
      error: 'Request could not be completed.',
      code: 'INVALID_REQUEST',
    });
  });
});
